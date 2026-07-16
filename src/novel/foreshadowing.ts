import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ForeshadowingEntry, ForeshadowingCategory } from './types';
import { NovelProjectManager } from './project';

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class ForeshadowingManager {
	private _entries: ForeshadowingEntry[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get dataDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName, 'foreshadowing');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadData(): ForeshadowingEntry[] {
		if (this._entries.length > 0) return this._entries;
		const fp = path.join(this.dataDir, 'entries.json');
		if (fs.existsSync(fp)) {
			try {
				this._entries = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._entries = [];
			}
		}
		return this._entries;
	}

	private saveData(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'entries.json'), JSON.stringify(this._entries, null, 2), 'utf-8');
	}

	getEntries(): ForeshadowingEntry[] {
		return this.loadData();
	}

	getEntriesByCategory(category: ForeshadowingCategory): ForeshadowingEntry[] {
		return this.loadData().filter((e) => e.category === category);
	}

	getActiveEntries(): ForeshadowingEntry[] {
		return this.loadData().filter((e) => e.status === 'planted' || e.status === 'active');
	}

	getPaidOffEntries(): ForeshadowingEntry[] {
		return this.loadData().filter((e) => e.status === 'paid_off');
	}

	addEntry(input: {
		description: string;
		category: ForeshadowingCategory;
		plantAt: { chapterId: string; detail: string };
		importance: number;
	}): ForeshadowingEntry {
		const entry: ForeshadowingEntry = {
			id: uid(),
			description: input.description,
			category: input.category,
			plantAt: input.plantAt,
			status: 'planted',
			importance: input.importance,
		};
		this._entries = this.loadData();
		this._entries.push(entry);
		this.saveData();
		return entry;
	}

	setPayoff(id: string, payoffAt: { chapterId: string; detail: string }): ForeshadowingEntry {
		return this.updateEntry(id, { payoffAt, status: 'paid_off' });
	}

	updateEntry(id: string, updates: Partial<ForeshadowingEntry>): ForeshadowingEntry {
		const list = this.loadData();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Foreshadowing entry not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._entries = list;
		this.saveData();
		return list[idx];
	}

	removeEntry(id: string): void {
		this._entries = this.loadData().filter((x) => x.id !== id);
		this.saveData();
	}

	getUnresolvedCount(): number {
		return this.getActiveEntries().length;
	}

	getStats(): { total: number; byCategory: Record<string, number>; paidOff: number; unpaid: number } {
		const entries = this.loadData();
		const total = entries.length;
		const byCategory: Record<string, number> = {};
		let paidOff = 0;
		let unpaid = 0;

		for (const e of entries) {
			byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
			if (e.status === 'paid_off') paidOff++;
			else unpaid++;
		}

		return { total, byCategory, paidOff, unpaid };
	}
}
