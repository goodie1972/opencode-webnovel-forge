import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ShuangPoint, ShuangType } from './types';
import { NovelProjectManager } from './project';

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class ShuangPointTracker {
	private _points: ShuangPoint[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get dataDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName, 'shuang');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadData(): ShuangPoint[] {
		if (this._points.length > 0) return this._points;
		const fp = path.join(this.dataDir, 'points.json');
		if (fs.existsSync(fp)) {
			try {
				this._points = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._points = [];
			}
		}
		return this._points;
	}

	private saveData(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'points.json'), JSON.stringify(this._points, null, 2), 'utf-8');
	}

	getPoints(): ShuangPoint[] {
		return this.loadData();
	}

	getPointsByChapter(chapterId: string): ShuangPoint[] {
		return this.loadData().filter((p) => p.chapterId === chapterId);
	}

	getPointsByType(type: ShuangType): ShuangPoint[] {
		return this.loadData().filter((p) => p.type === type);
	}

	addPoint(input: Omit<ShuangPoint, 'id' | 'placed'>): ShuangPoint {
		const p: ShuangPoint = { ...input, id: uid(), placed: false };
		this._points = this.loadData();
		this._points.push(p);
		this.saveData();
		return p;
	}

	updatePoint(id: string, updates: Partial<ShuangPoint>): ShuangPoint {
		const list = this.loadData();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`ShuangPoint not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._points = list;
		this.saveData();
		return list[idx];
	}

	removePoint(id: string): void {
		this._points = this.loadData().filter((x) => x.id !== id);
		this.saveData();
	}

	markPlaced(id: string): ShuangPoint {
		return this.updatePoint(id, { placed: true });
	}

	getStats(): { total: number; byType: Record<string, number>; avgIntensity: number; placementRate: number } {
		const points = this.loadData();
		const total = points.length;
		if (total === 0) return { total: 0, byType: {}, avgIntensity: 0, placementRate: 0 };

		const byType: Record<string, number> = {};
		let totalIntensity = 0;
		let placedCount = 0;

		for (const p of points) {
			byType[p.type] = (byType[p.type] ?? 0) + 1;
			totalIntensity += p.intensity;
			if (p.placed) placedCount++;
		}

		return {
			total,
			byType,
			avgIntensity: totalIntensity / total,
			placementRate: placedCount / total,
		};
	}

	getChapterDensity(chapterId: string): { count: number; avgIntensity: number; types: string[] } {
		const chapterPoints = this.getPointsByChapter(chapterId);
		if (chapterPoints.length === 0) return { count: 0, avgIntensity: 0, types: [] };

		const avgIntensity =
			chapterPoints.reduce((s, p) => s + p.intensity, 0) / chapterPoints.length;
		const types = [...new Set(chapterPoints.map((p) => p.type))];

		return { count: chapterPoints.length, avgIntensity, types };
	}
}
