import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PacingProfile } from './types';
import { NovelProjectManager } from './project';

export class PacingAnalyzer {
	private _profiles: PacingProfile[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get dataDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName, 'pacing');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadData(): PacingProfile[] {
		if (this._profiles.length > 0) return this._profiles;
		const fp = path.join(this.dataDir, 'profiles.json');
		if (fs.existsSync(fp)) {
			try {
				this._profiles = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._profiles = [];
			}
		}
		return this._profiles;
	}

	private saveData(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'profiles.json'), JSON.stringify(this._profiles, null, 2), 'utf-8');
	}

	getProfile(chapterId: string): PacingProfile | undefined {
		return this.loadData().find((p) => p.chapterId === chapterId);
	}

	upsertProfile(profile: PacingProfile): PacingProfile {
		const list = this.loadData();
		const idx = list.findIndex((p) => p.chapterId === profile.chapterId);
		if (idx >= 0) {
			list[idx] = profile;
		} else {
			list.push(profile);
		}
		this._profiles = list;
		this.saveData();
		return profile;
	}

	removeProfile(chapterId: string): void {
		this._profiles = this.loadData().filter((p) => p.chapterId !== chapterId);
		this.saveData();
	}

	getAllProfiles(): PacingProfile[] {
		return this.loadData();
	}

	computeProfile(chapterId: string, content: string): PacingProfile {
		const totalWords = content.length;

		const sceneBreaks = content.match(/^##\s/gm);
		const sceneCount = sceneBreaks ? sceneBreaks.length + 1 : Math.ceil(totalWords / 500);
		const avgSceneWords = sceneCount > 0 ? Math.round(totalWords / sceneCount) : totalWords;

		const tensionCurve = [0.3, 0.5, 0.7, 0.9, 0.6];

		const dialogueChars = (content.match(/[「」""]/g) || []).length;
		const dialogueRatio = totalWords > 0 ? dialogueChars / totalWords : 0;

		const actionWords = ['杀', '攻', '打', '冲', '跑', '追', '躲', '闪', '跳', '挡', '刺', '砍',
			'劈', '砸', '踢', '抓', '扔', '推', '拉', '抱', '举', '撑', '翻', '滚'];
		let actionCount = 0;
		for (const w of actionWords) {
			const regex = new RegExp(w, 'g');
			const matches = content.match(regex);
			if (matches) actionCount += matches.length;
		}
		const actionRatio = totalWords > 0 ? actionCount / totalWords : 0;
		const descriptionRatio = Math.max(0, 1 - dialogueRatio - actionRatio);

		const sentences = content.split(/[。！？\n]+/);
		const avgSentenceLen = sentences.length > 0
			? sentences.reduce((s, sen) => s + sen.length, 0) / sentences.length
			: 0;
		const readabilityScore = Math.max(0, Math.min(1, 1 - avgSentenceLen / 100));

		return {
			chapterId,
			totalWords,
			sceneCount,
			avgSceneWords,
			tensionCurve,
			dialogueRatio: Math.round(dialogueRatio * 100) / 100,
			descriptionRatio: Math.round(descriptionRatio * 100) / 100,
			actionRatio: Math.round(actionRatio * 100) / 100,
			readabilityScore: Math.round(readabilityScore * 100) / 100,
		};
	}

	getChapterStats(): { totalChapters: number; avgWords: number; avgReadability: number; avgScenes: number } {
		const profiles = this.loadData();
		if (profiles.length === 0) {
			return { totalChapters: 0, avgWords: 0, avgReadability: 0, avgScenes: 0 };
		}

		const totalWords = profiles.reduce((s, p) => s + p.totalWords, 0);
		const totalReadability = profiles.reduce((s, p) => s + p.readabilityScore, 0);
		const totalScenes = profiles.reduce((s, p) => s + p.sceneCount, 0);
		const n = profiles.length;

		return {
			totalChapters: n,
			avgWords: Math.round(totalWords / n),
			avgReadability: Math.round((totalReadability / n) * 100) / 100,
			avgScenes: Math.round((totalScenes / n) * 100) / 100,
		};
	}
}
