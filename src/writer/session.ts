"use strict";

import * as fs from 'node:fs';
import * as path from 'node:path';
import { NovelProjectManager } from '../novel/project';
import { WorkflowStateMachine } from '../novel/workflow';
import type { WorkflowStage } from '../novel/types';
import { WORKFLOW_STAGES, WORKFLOW_LABELS } from '../novel/types';
import type { StageRequirements } from '../novel/workflow';
import { buildAgentContext } from './context/assemble';
import type { AgentContext } from './context/assemble';
import { runWorldBuilding, runCharacterDesign, runOutline, runFirstDraft, runRevision, runPolish } from './stages';
import type { StageResult, StageInput } from './stages/types';
import { reviewContent, saveQualityReport } from './quality/quality-review';
import { injectStyle } from './style/inject-style';
import { generateControlCard, saveControlCard } from './control/control-card';
import { createEmptyState, loadDynamicState, saveDynamicState, updateAfterChapter } from './control/dynamic-state';
import type { DynamicState } from './control/types';

export type SessionMode = 'auto' | 'semi-auto';

export interface SessionConfig {
  mode: SessionMode;
  masterStyle?: string;
  autoSaveInterval?: number; // ms, default 60000
}

export interface WritingSessionState {
  projectDir: string;
  config: SessionConfig;
  workflow: {
    currentStage: WorkflowStage;
    stageHistory: { stage: WorkflowStage; enteredAt: string; exitedAt?: string }[];
    stageData: [WorkflowStage, Record<string, unknown>][];
  };
  startedAt: string;
  updatedAt: string;
}

export interface SessionStatus {
  projectDir: string;
  mode: SessionMode;
  currentStage: WorkflowStage;
  stageLabel: string;
  progress: number;
  isComplete: boolean;
  stageRequirements: StageRequirements;
  totalWords: number;
  totalChapters: number;
}

export class WritingSession {
  private pm: NovelProjectManager;
  private workflow: WorkflowStateMachine;
  readonly config: SessionConfig;
  readonly projectDir: string;

  constructor(workspaceRoot: string, projectDir: string, config?: Partial<SessionConfig>) {
    this.pm = new NovelProjectManager(workspaceRoot);
    this.projectDir = projectDir;
    this.config = {
      mode: 'semi-auto',
      autoSaveInterval: 60000,
      ...config,
    };
    
    this.workflow = new WorkflowStateMachine('world_building');
    
    // Load project if it exists; otherwise run with defaults
    try {
      this.pm.load(projectDir);
    } catch {
      // Project doesn't exist yet — will be created on first run
    }
  }

  static async create(workspaceRoot: string, projectDir: string, config?: Partial<SessionConfig>): Promise<WritingSession> {
    const session = new WritingSession(workspaceRoot, projectDir, config);
    await session.save();
    return session;
  }

  static async resume(workspaceRoot: string, projectDir: string): Promise<WritingSession | null> {
    try {
      const session = await WritingSession.load(workspaceRoot, projectDir);
      if (!session) return null;
      return session;
    } catch (error) {
      console.error(`Failed to resume session for project ${projectDir}:`, error);
      return null;
    }
  }

  async runCurrentStage(userInstructions?: string): Promise<StageResult> {
    const currentStage = this.workflow.currentStage;
    const project = this.pm.load(this.projectDir);
    
    // Build agent context
    const agentContext: AgentContext = await buildAgentContext(this.pm, this.projectDir);
    
    // Prepare stage input
    const previousOutput = this.getPreviousStageOutput(currentStage);
    
    // Load or create dynamic state
    let dynamicState = loadDynamicState(this.pm.projectsDir, this.projectDir);
    if (!dynamicState) {
      dynamicState = createEmptyState();
      dynamicState.chaptersWritten = project.chapters.length || 0;
    }
    
    // Generate control card for this stage
    const controlCard = generateControlCard(
      project.chapters.length + 1,
      `Chapter ${project.chapters.length + 1}`,
      agentContext,
      dynamicState,
    );
    
    const stageInput: StageInput = {
      context: agentContext,
      masterStyle: this.config.masterStyle,
      userInstructions,
      previousOutput,
      projectsDir: this.pm.projectsDir,
      projectDir: this.projectDir,
      controlCard,
    };

    // Map stage to runner function
    const runnerMap = {
      'world_building': runWorldBuilding,
      'character_design': runCharacterDesign,
      'outline': runOutline,
      'first_draft': runFirstDraft,
      'revision': runRevision,
      'polish': runPolish,
    } as any;

    const runner = runnerMap[currentStage];
    if (!runner) {
      throw new Error(`No runner found for stage: ${currentStage}`);
    }

    // Call runner with style injection
    const baseResult = await runner(stageInput);
    const styledOutput = injectStyle(baseResult.output, this.config.masterStyle || '');

    // Create a styled result that includes the styled output
    const styledResult: StageResult = {
      output: styledOutput,
      agentUsed: baseResult.agentUsed,
      tokensUsed: baseResult.tokensUsed,
      stageName: baseResult.stageName,
    };

    // Run quality review and save report
    const qualityReport = reviewContent(styledOutput);
    try {
      saveQualityReport(qualityReport, this.pm.projectsDir, this.projectDir);
    } catch {
      // Best-effort: don't fail the stage if report saving fails
    }

    // Update dynamic state after chapter written
    const updatedState = updateAfterChapter(dynamicState, controlCard);
    saveDynamicState(this.pm.projectsDir, this.projectDir, updatedState);

    // Save to workflow stageData - store the full result, not just output
    this.workflow.setStageData(currentStage, 'result', styledResult);
    await this.save();

    return styledResult;
  }

  async runFullPipeline(userInstructions?: string): Promise<{ results: StageResult[]; status: SessionStatus }> {
    const results: StageResult[] = [];
    
    // Loop through stages until done
    while (this.workflow.currentStage !== 'done') {
      const result = await this.runCurrentStage(userInstructions);
      results.push(result);

      // Advance stage if in auto mode
      if (this.config.mode === 'auto') {
        await this.advanceStage();
      }
    }
    
    await this.save();
    const status = this.getStatus();
    
    return { results, status };
  }

  async advanceStage(): Promise<{ success: boolean; message: string }> {
    // Store current stage output in workflow stageData
    const currentStage = this.workflow.currentStage;
    if (currentStage !== 'done') {
      this.workflow.setStageData(currentStage, 'exited', true);
    }

    // Advance workflow
    const result = this.workflow.advance();
    await this.save();
    
    return result;
  }

  getStatus(): SessionStatus {
    const project = this.pm.load(this.projectDir);
    const workflowStatus = this.workflow.getStatus();
    
    return {
      projectDir: this.projectDir,
      mode: this.config.mode,
      currentStage: workflowStatus.stage,
      stageLabel: workflowStatus.label,
      progress: workflowStatus.progress,
      isComplete: workflowStatus.isComplete,
      stageRequirements: workflowStatus.requirements,
      totalWords: project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
      totalChapters: project.chapters.length,
    };
  }

  async save(): Promise<void> {
    const projectsDir = this.pm.projectsDir;
    const targetDir = path.join(projectsDir, this.projectDir);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Get stage data entries from the workflow
    const stageDataMap = (this.workflow as any)._stageData as Map<WorkflowStage, Record<string, unknown>>;
    const stageDataEntries = Array.from(stageDataMap.entries()) as [WorkflowStage, Record<string, unknown>][];
    
    const sessionState: WritingSessionState = {
      projectDir: this.projectDir,
      config: this.config,
      workflow: {
        currentStage: this.workflow.currentStage,
        stageHistory: [...this.workflow.history],
        stageData: stageDataEntries,
      },
      startedAt: this.workflow.history[0]?.enteredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const filename = '.writing-session.json';
    const tempPath = path.join(targetDir, `${filename}.tmp`);
    const finalPath = path.join(targetDir, filename);
    
    fs.writeFileSync(tempPath, JSON.stringify(sessionState, null, 2), 'utf-8');
    fs.renameSync(tempPath, finalPath);
  }

  static async load(workspaceRoot: string, projectDir: string): Promise<WritingSession | null> {
    const pm = new NovelProjectManager(workspaceRoot);
    
    // Verify project exists
    try {
      const project = pm.load(projectDir);
    } catch {
      return null;
    }
    
    const targetDir = pm.projectsDir;
    const sessionPath = path.join(targetDir, projectDir, '.writing-session.json');
    
    if (!fs.existsSync(sessionPath)) {
      return null;
    }
    
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) as WritingSessionState;
      const session = new WritingSession(workspaceRoot, sessionData.projectDir, sessionData.config);
      session.workflow = WorkflowStateMachine.deserialize({
        currentStage: sessionData.workflow.currentStage,
        stageHistory: sessionData.workflow.stageHistory,
        stageData: sessionData.workflow.stageData,
      });
      return session;
    } catch (error) {
      console.error(`Failed to load session from ${sessionPath}:`, error);
      return null;
    }
  }

  private getPreviousStageOutput(stage: WorkflowStage): string | undefined {
    if (stage === 'world_building') return undefined;
    
    const stageIndex = WORKFLOW_STAGES.indexOf(stage);
    if (stageIndex <= 0) return undefined;
    
    const previousStage = WORKFLOW_STAGES[stageIndex - 1];
    const result = this.workflow.getStageData<StageResult>(previousStage, 'result');
    
    return result?.output || undefined;
  }
}