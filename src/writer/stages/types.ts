import type { AgentContext } from '../context/assemble';

export interface StageInput {
  context: AgentContext;
  masterStyle?: string;
  userInstructions?: string;
  previousOutput?: string;
  chapterIndex?: number;
}

export interface StageResult {
  output: string;
  agentUsed: string;
  tokensUsed: number;
  stageName: string;
}

export type StageRunner = (input: StageInput) => Promise<StageResult>;
