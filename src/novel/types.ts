export interface NovelMeta {
	title: string;
	author: string;
	genre: string;
	tags: string[];
	description: string;
	targetWords: number;
	createdAt: string;
	updatedAt: string;
}

export interface ChapterMeta {
	id: string;
	title: string;
	index: number;
	wordCount: number;
	status: ChapterStatus;
	createdAt: string;
	updatedAt: string;
}

export type ChapterStatus = 'draft' | 'revising' | 'polished' | 'final';

export interface NovelSettings {
	language: 'zh' | 'en';
	masterStyle?: string;
	agentOverrides: Record<string, { model?: string; temperature?: number }>;
}

export interface Faction {
	id: string;
	name: string;
	description: string;
	goals: string[];
	members: string[];
	power: number;
}

export interface Location {
	id: string;
	name: string;
	description: string;
	type: string;
	parentId?: string;
}

export interface WorldEvent {
	id: string;
	title: string;
	description: string;
	era: string;
	year: number;
	impact: string;
}

export interface CharacterProfile {
	id: string;
	name: string;
	aliases: string[];
	role: CharacterRole;
	traits: string[];
	background: string;
	goal: string;
	arc: string;
	voice: string;
	relationships: CharacterRelation[];
}

export type CharacterRole = 'protagonist' | 'love_interest' | 'side' | 'antagonist' | 'supporting' | 'mentor' | 'villain';

export interface CharacterRelation {
	targetId: string;
	type: string;
	description: string;
}

export interface PlotArc {
	id: string;
	title: string;
	phase: number;
	summary: string;
	chapters: string[];
	status: ArcStatus;
}

export type ArcStatus = 'planning' | 'writing' | 'completed';

export interface ChapterOutline {
	id: string;
	chapterId: string;
	scenes: SceneBeat[];
	tensionStart: number;
	tensionEnd: number;
}

export interface SceneBeat {
	id: string;
	summary: string;
	pov: string;
	wordEstimate: number;
	purpose: 'setup' | 'conflict' | 'revelation' | 'climax' | 'resolution' | 'transition' | 'shuang';
}

export interface Subplot {
	id: string;
	name: string;
	description: string;
	relatedArc: string;
	status: 'active' | 'resolved' | 'abandoned';
}

export interface ShuangPoint {
	id: string;
	chapterId: string;
	type: ShuangType;
	description: string;
	intensity: number;
	targetWordRange: [number, number];
	placed: boolean;
}

export type ShuangType = 'face_slap' | 'breakthrough' | 'secret_reveal' | 'identity_reveal' | 'showdown' | 'rescue' | 'face';

export interface PacingProfile {
	chapterId: string;
	totalWords: number;
	sceneCount: number;
	avgSceneWords: number;
	tensionCurve: number[];
	dialogueRatio: number;
	descriptionRatio: number;
	actionRatio: number;
	readabilityScore: number;
}

export interface ForeshadowingEntry {
	id: string;
	description: string;
	category: ForeshadowingCategory;
	plantAt: { chapterId: string; detail: string };
	payoffAt?: { chapterId: string; detail: string };
	status: ForeshadowingStatus;
	importance: number;
}

export type ForeshadowingCategory = 'character' | 'plot' | 'item' | 'prophecy' | 'mystery' | 'world' | 'relationship';
export type ForeshadowingStatus = 'planted' | 'active' | 'paid_off' | 'abandoned';

export interface MemoryFact {
	id: string;
	fact: string;
	category: MemoryCategory;
	source: string;
	confirmed: boolean;
	tags: string[];
}

export type MemoryCategory = 'character' | 'location' | 'event' | 'lore' | 'relationship' | 'timeline' | 'item';

export type WorkflowStage = 'world_building' | 'character_design' | 'outline' | 'first_draft' | 'revision' | 'polish' | 'done';

export const WORKFLOW_STAGES: WorkflowStage[] = [
	'world_building',
	'character_design',
	'outline',
	'first_draft',
	'revision',
	'polish',
];

export const WORKFLOW_LABELS: Record<WorkflowStage, string> = {
	world_building: '世界观构建',
	character_design: '角色设计',
	outline: '大纲创作',
	first_draft: '初稿',
	revision: '修改',
	polish: '精修',
	done: '完成',
};

export const SHUANG_LABELS: Record<ShuangType, string> = {
	face_slap: '打脸',
	breakthrough: '突破',
	secret_reveal: '秘密揭露',
	identity_reveal: '身份揭露',
	showdown: '对决',
	rescue: '救援',
	face: '装逼打脸',
};
