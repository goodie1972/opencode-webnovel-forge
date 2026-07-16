import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CharacterProfile, CharacterRole, CharacterRelation } from './types';
import { NovelProjectManager } from './project';

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class CharacterService {
	private _characters: CharacterProfile[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get dataDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName, 'characters');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadData(): CharacterProfile[] {
		if (this._characters.length > 0) return this._characters;
		const fp = path.join(this.dataDir, 'characters.json');
		if (fs.existsSync(fp)) {
			try {
				this._characters = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._characters = [];
			}
		}
		return this._characters;
	}

	private saveData(): void {
		this.ensureDir();
		fs.writeFileSync(
			path.join(this.dataDir, 'characters.json'),
			JSON.stringify(this._characters, null, 2),
			'utf-8',
		);
	}

	getCharacters(): CharacterProfile[] {
		return this.loadData();
	}

	getCharacter(id: string): CharacterProfile {
		const c = this.loadData().find((x) => x.id === id);
		if (!c) throw new Error(`Character not found: ${id}`);
		return c;
	}

	addCharacter(input: Omit<CharacterProfile, 'id' | 'relationships'>): CharacterProfile {
		const c: CharacterProfile = {
			...input,
			id: uid(),
			relationships: [],
		};
		this._characters = this.loadData();
		this._characters.push(c);
		this.saveData();
		return c;
	}

	updateCharacter(id: string, updates: Partial<CharacterProfile>): CharacterProfile {
		const list = this.loadData();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Character not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._characters = list;
		this.saveData();
		return list[idx];
	}

	removeCharacter(id: string): void {
		this._characters = this.loadData().filter((x) => x.id !== id);
		this.saveData();
	}

	addRelationship(charId: string, relation: Omit<CharacterRelation, 'targetId'> & { targetId: string }): CharacterProfile {
		const c = this.getCharacter(charId);
		if (c.relationships.some((r) => r.targetId === relation.targetId)) {
			throw new Error(`Relationship to ${relation.targetId} already exists`);
		}
		c.relationships.push(relation);
		return this.updateCharacter(charId, { relationships: c.relationships });
	}

	removeRelationship(charId: string, targetId: string): CharacterProfile {
		const c = this.getCharacter(charId);
		c.relationships = c.relationships.filter((r) => r.targetId !== targetId);
		return this.updateCharacter(charId, { relationships: c.relationships });
	}

	getCharactersByRole(role: CharacterRole): CharacterProfile[] {
		return this.loadData().filter((c) => c.role === role);
	}

	getAll(): { characters: CharacterProfile[] } {
		return { characters: this.getCharacters() };
	}
}
