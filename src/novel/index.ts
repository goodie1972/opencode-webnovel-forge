export { NovelProjectManager } from './project';
export type { CreateProjectInput, CreateProjectResult, ProjectData } from './project';

export { WorldService } from './world';
export type { Faction, Location, WorldEvent } from './types';

export { CharacterService } from './character';
export type { CharacterProfile, CharacterRole, CharacterRelation } from './types';

export { PlotService } from './plot';
export type { ChapterOutlineData } from './plot';
export type { PlotArc, Subplot, SceneBeat } from './types';

export { ShuangPointTracker } from './shuang';
export type { ShuangPoint, ShuangType } from './types';

export { PacingAnalyzer } from './pacing';
export type { PacingProfile } from './types';

export { ForeshadowingManager } from './foreshadowing';
export type { ForeshadowingEntry, ForeshadowingCategory, ForeshadowingStatus } from './types';

export { MemoryService } from './memory';
export type { MemoryFact, MemoryCategory } from './types';

export { WorkflowStateMachine } from './workflow';
export type { StageRequirements } from './workflow';
export type { WorkflowStage } from './types';

export {
	WORKFLOW_STAGES,
	WORKFLOW_LABELS,
	SHUANG_LABELS,
} from './types';

export { WritingSession } from '../writer/session';
export { callAgent } from '../writer/agent-runtime';
export type { SessionConfig, SessionMode, SessionStatus, WritingSessionState } from '../writer/session';
export type { AgentCallOptions, AgentResponse } from '../writer/agent-runtime';
