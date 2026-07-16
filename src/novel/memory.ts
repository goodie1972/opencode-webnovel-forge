import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MemoryFact, MemoryCategory } from './types';
import { NovelProjectManager } from './project';

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class MemoryService {
	private _facts: MemoryFact[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get dataDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName, 'memory');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadData(): MemoryFact[] {
		if (this._facts.length > 0) return this._facts;
		const fp = path.join(this.dataDir, 'facts.json');
		if (fs.existsSync(fp)) {
			try {
				this._facts = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._facts = [];
			}
		}
		return this._facts;
	}

	private saveData(): void {
		this.ensureDir();
		fs.writeFileSync(path.join(this.dataDir, 'facts.json'), JSON.stringify(this._facts, null, 2), 'utf-8');
	}

	getFacts(): MemoryFact[] {
		return this.loadData();
	}

	getFactsByCategory(category: MemoryCategory): MemoryFact[] {
		return this.loadData().filter((f) => f.category === category);
	}

	searchFacts(query: string): MemoryFact[] {
		const q = query.toLowerCase();
		return this.loadData().filter((f) => f.fact.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q)));
	}

	addFact(input: Omit<MemoryFact, 'id' | 'confirmed'>): MemoryFact {
		const fact: MemoryFact = { ...input, id: uid(), confirmed: false };
		this._facts = this.loadData();
		this._facts.push(fact);
		this.saveData();
		return fact;
	}

	confirmFact(id: string): MemoryFact {
		return this.updateFact(id, { confirmed: true });
	}

	updateFact(id: string, updates: Partial<MemoryFact>): MemoryFact {
		const list = this.loadData();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Fact not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._facts = list;
		this.saveData();
		return list[idx];
	}

	removeFact(id: string): void {
		this._facts = this.loadData().filter((x) => x.id !== id);
		this.saveData();
	}

	getContradictions(): { factA: MemoryFact; factB: MemoryFact }[] {
		const facts = this.loadData();
		const result: { factA: MemoryFact; factB: MemoryFact }[] = [];

		for (let i = 0; i < facts.length; i++) {
			for (let j = i + 1; j < facts.length; j++) {
				if (facts[i].category === facts[j].category && facts[i].fact !== facts[j].fact) {
					result.push({ factA: facts[i], factB: facts[j] });
				}
			}
		}

		return result;
	}

	getStats(): { total: number; byCategory: Record<string, number>; confirmed: number; unconfirmed: number } {
		const facts = this.loadData();
		const byCategory: Record<string, number> = {};
		let confirmed = 0;
		let unconfirmed = 0;

		for (const f of facts) {
			byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
			if (f.confirmed) confirmed++;
			else unconfirmed++;
		}

		return { total: facts.length, byCategory, confirmed, unconfirmed };
	}
}
