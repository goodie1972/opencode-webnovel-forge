import type { AgentContext } from '../context/assemble';
import type { ChapterControlCard } from '../control/types';

export interface StageInput {
  context: AgentContext;
  masterStyle?: string;
  userInstructions?: string;
  previousOutput?: string;
  chapterIndex?: number;
  projectsDir?: string;
  projectDir?: string;
  controlCard?: ChapterControlCard;
}

export interface StageResult {
  output: string;
  agentUsed: string;
  tokensUsed: number;
  stageName: string;
}

export type StageRunner = (input: StageInput) => Promise<StageResult>;
