import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PlotArc, Subplot } from './types';
import { NovelProjectManager } from './project';

export interface ChapterOutlineData {
	chapterId: string;
	scenes: import('./types').SceneBeat[];
	tensionStart: number;
	tensionEnd: number;
}

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class PlotService {
	private _arcs: PlotArc[] = [];
	private _outlines: ChapterOutlineData[] = [];
	private _subplots: Subplot[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get dataDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName, 'plot');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadArcs(): PlotArc[] {
		if (this._arcs.length > 0) return this._arcs;
		const fp = path.join(this.dataDir, 'arcs.json');
		if (fs.existsSync(fp)) {
			try {
				this._arcs = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._arcs = [];
			}
		}
		return this._arcs;
	}

	private saveArcs(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'arcs.json'), JSON.stringify(this._arcs, null, 2), 'utf-8');
	}

	private loadOutlines(): ChapterOutlineData[] {
		if (this._outlines.length > 0) return this._outlines;
		const fp = path.join(this.dataDir, 'outlines.json');
		if (fs.existsSync(fp)) {
			try {
				this._outlines = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._outlines = [];
			}
		}
		return this._outlines;
	}

	private saveOutlines(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'outlines.json'), JSON.stringify(this._outlines, null, 2), 'utf-8');
	}

	private loadSubplots(): Subplot[] {
		if (this._subplots.length > 0) return this._subplots;
		const fp = path.join(this.dataDir, 'subplots.json');
		if (fs.existsSync(fp)) {
			try {
				this._subplots = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._subplots = [];
			}
		}
		return this._subplots;
	}

	private saveSubplots(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'subplots.json'), JSON.stringify(this._subplots, null, 2), 'utf-8');
	}

	// ─── Arcs ─────────────────────────────────────────────────────

	getArcs(): PlotArc[] {
		return this.loadArcs();
	}

	getArc(id: string): PlotArc {
		const a = this.loadArcs().find((x) => x.id === id);
		if (!a) throw new Error(`Arc not found: ${id}`);
		return a;
	}

	addArc(input: { title: string; phase: number; summary: string }): PlotArc {
		const a: PlotArc = {
			id: uid(),
			title: input.title,
			phase: input.phase,
			summary: input.summary,
			chapters: [],
			status: 'planning',
		};
		this._arcs = this.loadArcs();
		this._arcs.push(a);
		this.saveArcs();
		return a;
	}

	updateArc(id: string, updates: Partial<PlotArc>): PlotArc {
		const list = this.loadArcs();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Arc not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._arcs = list;
		this.saveArcs();
		return list[idx];
	}

	removeArc(id: string): void {
		this._arcs = this.loadArcs().filter((x) => x.id !== id);
		this.saveArcs();
	}

	// ─── Outlines ─────────────────────────────────────────────────

	getOutline(chapterId: string): ChapterOutlineData | undefined {
		return this.loadOutlines().find((o) => o.chapterId === chapterId);
	}

	upsertOutline(chapterId: string, data: Omit<ChapterOutlineData, 'chapterId'>): ChapterOutlineData {
		const list = this.loadOutlines();
		const idx = list.findIndex((o) => o.chapterId === chapterId);
		const outline: ChapterOutlineData = { chapterId, ...data };
		if (idx >= 0) {
			list[idx] = outline;
		} else {
			list.push(outline);
		}
		this._outlines = list;
		this.saveOutlines();
		return outline;
	}

	removeOutline(chapterId: string): void {
		this._outlines = this.loadOutlines().filter((o) => o.chapterId !== chapterId);
		this.saveOutlines();
	}

	// ─── Subplots ─────────────────────────────────────────────────

	getSubplots(): Subplot[] {
		return this.loadSubplots();
	}

	addSubplot(input: Omit<Subplot, 'id'>): Subplot {
		const s: Subplot = { ...input, id: uid() };
		this._subplots = this.loadSubplots();
		this._subplots.push(s);
		this.saveSubplots();
		return s;
	}

	updateSubplot(id: string, updates: Partial<Subplot>): Subplot {
		const list = this.loadSubplots();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Subplot not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._subplots = list;
		this.saveSubplots();
		return list[idx];
	}

	removeSubplot(id: string): void {
		this._subplots = this.loadSubplots().filter((x) => x.id !== id);
		this.saveSubplots();
	}

	getAll(): { arcs: PlotArc[]; outlines: ChapterOutlineData[]; subplots: Subplot[] } {
		return {
			arcs: this.getArcs(),
			outlines: this.loadOutlines(),
			subplots: this.getSubplots(),
		};
	}
}
