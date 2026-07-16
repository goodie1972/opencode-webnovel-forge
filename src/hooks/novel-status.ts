import type { Hooks } from '@opencode-ai/plugin';
import { NovelProjectManager } from '../novel';
import { safeHook } from './utils';
import { log } from '../utils';

const ACTIVE_PROJECT_FILE = '.novel-active';

export function createNovelStatusHook(directory: string): Partial<Hooks> {
	const pm = new NovelProjectManager(directory);

	function getActiveProject(): { dirName: string; project: import('../novel').ProjectData } | null {
		try {
			const { readFileSync, existsSync } = require('node:fs');
			const { join } = require('node:path');
			const activePath = join(directory, ACTIVE_PROJECT_FILE);
			if (!existsSync(activePath)) return null;
			const dirName = readFileSync(activePath, 'utf-8').trim();
			if (!dirName) return null;
			const project = pm.load(dirName);
			return { dirName, project };
		} catch {
			return null;
		}
	}

	function formatStatus(dirName: string, project: import('../novel').ProjectData): string {
		const { meta, chapters } = project;
		const totalWords = chapters.reduce((s, c) => s + c.wordCount, 0);
		const doneChapters = chapters.filter((c) => c.status === 'final').length;
		const progress = meta.targetWords > 0
			? Math.round((totalWords / meta.targetWords) * 100)
			: 0;

		return [
			`[小说项目: ${meta.title}]`,
			`  作者: ${meta.author} | 类型: ${meta.genre}`,
			`  章节: ${doneChapters}/${chapters.length} 已完成 | 总字数: ${totalWords}/${meta.targetWords} (${progress}%)`,
		].join('\n');
	}

	return {
		'experimental.chat.system.transform': safeHook(
			async (
				_input: { sessionID?: string; model?: unknown },
				output: { system: string[] },
			): Promise<void> => {
				try {
					const active = getActiveProject();
					if (active) {
						output.system.push(formatStatus(active.dirName, active.project));
					}
				} catch (error) {
					log('Novel status hook failed:', error);
				}
			},
		),
	};
}
