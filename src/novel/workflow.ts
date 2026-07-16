import type { WorkflowStage } from './types';
import { WORKFLOW_STAGES, WORKFLOW_LABELS } from './types';

export interface StageRequirements {
	stage: WorkflowStage;
	requiredServices: string[];
	entryMessage: string;
	exitCriteria: string[];
}

const STAGE_REQUIREMENTS: Record<Exclude<WorkflowStage, 'done'>, StageRequirements> = {
	world_building: {
		stage: 'world_building',
		requiredServices: ['world'],
		entryMessage: '开始世界观构建阶段。定义世界规则、势力分布、地理环境和历史事件。',
		exitCriteria: [
			'世界观设定完成',
			'势力关系图建立',
			'关键地理位置确定',
			'力量体系 / 世界规则明确',
		],
	},
	character_design: {
		stage: 'character_design',
		requiredServices: ['character'],
		entryMessage: '开始角色设计阶段。创建主角、配角、反派及其关系网。',
		exitCriteria: [
			'主角人设完整（背景、动机、成长弧）',
			'核心配角设定完成',
			'反派 / 对手设定完成',
			'角色关系网建立',
		],
	},
	outline: {
		stage: 'outline',
		requiredServices: ['plot'],
		entryMessage: '开始大纲创作阶段。设计情节弧线、章节大纲和爽点布局。',
		exitCriteria: [
			'主线情节弧确定',
			'章节大纲完成',
			'爽点分布图完成',
			'伏笔计划制定',
		],
	},
	first_draft: {
		stage: 'first_draft',
		requiredServices: ['writer'],
		entryMessage: '开始初稿创作阶段。按照大纲逐章写作，注重完成度而非完美。',
		exitCriteria: [
			'所有章节初稿完成',
			'每章字数达标',
			'故事主线完整',
		],
	},
	revision: {
		stage: 'revision',
		requiredServices: ['editor', 'shuang', 'pacing'],
		entryMessage: '进入修改阶段。检查情节逻辑、节奏控制和角色一致性。',
		exitCriteria: [
			'情节逻辑漏洞修复',
			'节奏问题修正',
			'角色行为一致性检查通过',
			'爽点密度达标',
		],
	},
	polish: {
		stage: 'polish',
		requiredServices: ['copy_editor', 'pacing'],
		entryMessage: '进入精修阶段。打磨语言细节，统一文风和格式。',
		exitCriteria: [
			'语言风格统一',
			'语法错误修正',
			'格式规范一致',
			'最终版定稿',
		],
	},
};

export class WorkflowStateMachine {
	private _currentStage: WorkflowStage = 'world_building';
	private _stageHistory: { stage: WorkflowStage; enteredAt: string; exitedAt?: string }[] = [];
	private _stageData = new Map<WorkflowStage, Record<string, unknown>>();

	constructor(initialStage: WorkflowStage = 'world_building') {
		this._currentStage = initialStage;
		this._stageHistory.push({
			stage: initialStage,
			enteredAt: new Date().toISOString(),
		});
	}

	get currentStage(): WorkflowStage {
		return this._currentStage;
	}

	get stageIndex(): number {
		return WORKFLOW_STAGES.indexOf(this._currentStage);
	}

	get progress(): number {
		return (this.stageIndex + 1) / WORKFLOW_STAGES.length;
	}

	get currentLabel(): string {
		return WORKFLOW_LABELS[this._currentStage];
	}

	get history(): readonly { stage: WorkflowStage; enteredAt: string; exitedAt?: string }[] {
		return this._stageHistory;
	}

	get isComplete(): boolean {
		return this._currentStage === 'done';
	}

	getStageData<T>(stage: WorkflowStage, key: string): T | undefined {
		const data = this._stageData.get(stage);
		return data?.[key] as T | undefined;
	}

	setStageData(stage: WorkflowStage, key: string, value: unknown): void {
		const existing = this._stageData.get(stage) ?? {};
		existing[key] = value;
		this._stageData.set(stage, existing);
	}

	getRequirements(stage?: WorkflowStage): StageRequirements {
		const s = stage ?? this._currentStage;
		if (s === 'done') {
			return {
				stage: 'done',
				requiredServices: [],
				entryMessage: '',
				exitCriteria: [],
			};
		}
		return STAGE_REQUIREMENTS[s];
	}

	canTransitionTo(target: WorkflowStage): { allowed: boolean; reason?: string } {
		const currentIdx = WORKFLOW_STAGES.indexOf(this._currentStage);
		const targetIdx = WORKFLOW_STAGES.indexOf(target);

		if (this._currentStage === 'done') {
			return { allowed: false, reason: '工作流已完成，无法继续转换' };
		}

		if (target === 'done') {
			if (currentIdx !== WORKFLOW_STAGES.length - 1) {
				return { allowed: false, reason: `必须在精修阶段后才能完成。当前阶段: ${this.currentLabel}` };
			}
			return { allowed: true };
		}

		if (targetIdx < 0) {
			return { allowed: false, reason: `未知阶段: ${target}` };
		}

		if (targetIdx > currentIdx + 1) {
			return {
				allowed: false,
				reason: `不能跳过阶段。当前: ${this.currentLabel}, 目标: ${WORKFLOW_LABELS[target]}`,
			};
		}

		if (targetIdx === currentIdx) {
			return { allowed: false, reason: '已经在当前阶段' };
		}

		return { allowed: true };
	}

	transitionTo(target: WorkflowStage): { success: boolean; message: string } {
		const check = this.canTransitionTo(target);
		if (!check.allowed) {
			return { success: false, message: check.reason ?? '转换被拒绝' };
		}

		if (this._currentStage !== 'done') {
			const currentEntry = this._stageHistory[this._stageHistory.length - 1];
			if (currentEntry) {
				currentEntry.exitedAt = new Date().toISOString();
			}
		}

		this._currentStage = target;

		if (target !== 'done') {
			this._stageHistory.push({
				stage: target,
				enteredAt: new Date().toISOString(),
			});
		}

		if (target === 'done') {
			return { success: true, message: '✅ 工作流完成' };
		}
		const req = STAGE_REQUIREMENTS[target];
		return { success: true, message: `✅ 已进入 ${req.stage} — ${req.entryMessage}` };
	}

	advance(): { success: boolean; message: string } {
		const currentIdx = WORKFLOW_STAGES.indexOf(this._currentStage);
		if (currentIdx < 0 || currentIdx >= WORKFLOW_STAGES.length - 1) {
			return this.transitionTo('done');
		}
		return this.transitionTo(WORKFLOW_STAGES[currentIdx + 1]);
	}

	getStatus(): {
		stage: WorkflowStage;
		label: string;
		index: number;
		total: number;
		progress: number;
		isComplete: boolean;
		requirements: StageRequirements;
	} {
		return {
			stage: this._currentStage,
			label: this.currentLabel,
			index: this.stageIndex,
			total: WORKFLOW_STAGES.length,
			progress: this.progress,
			isComplete: this.isComplete,
			requirements: this.getRequirements(),
		};
	}

	serialize(): {
		currentStage: WorkflowStage;
		stageHistory: { stage: WorkflowStage; enteredAt: string; exitedAt?: string }[];
		stageData: [WorkflowStage, Record<string, unknown>][];
	} {
		return {
			currentStage: this._currentStage,
			stageHistory: this._stageHistory,
			stageData: [...this._stageData.entries()] as [WorkflowStage, Record<string, unknown>][],
		};
	}

	static deserialize(data: {
		currentStage: WorkflowStage;
		stageHistory: { stage: WorkflowStage; enteredAt: string; exitedAt?: string }[];
		stageData: [WorkflowStage, Record<string, unknown>][];
	}): WorkflowStateMachine {
		const wf = new WorkflowStateMachine(data.currentStage);
		wf._stageHistory = data.stageHistory;
		wf._stageData = new Map(data.stageData);
		return wf;
	}
}
