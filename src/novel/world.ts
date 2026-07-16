import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Faction, Location, WorldEvent } from './types';
import { NovelProjectManager } from './project';

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class WorldService {
	private _factions: Faction[] = [];
	private _locations: Location[] = [];
	private _events: WorldEvent[] = [];

	constructor(
		private projectManager: NovelProjectManager,
		private dirName: string,
	) {}

	private get projectDir(): string {
		return path.join(this.projectManager.projectsDir, this.dirName);
	}

	private get dataDir(): string {
		return path.join(this.projectDir, 'world');
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.dataDir)) {
			fs.mkdirSync(this.dataDir, { recursive: true });
		}
	}

	private loadFactions(): Faction[] {
		if (this._factions) return this._factions;
		const fp = path.join(this.dataDir, 'factions.json');
		if (fs.existsSync(fp)) {
			try {
				this._factions = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._factions = [];
			}
		} else {
			this._factions = [];
		}
		return this._factions;
	}

	private saveFactions(): void {
		this.ensureDir();
		fs.writeFileSync(
			path.join(this.dataDir, 'factions.json'),
			JSON.stringify(this._factions ?? [], null, 2),
			'utf-8',
		);
	}

	private loadLocations(): Location[] {
		if (this._locations) return this._locations;
		const fp = path.join(this.dataDir, 'locations.json');
		if (fs.existsSync(fp)) {
			try {
				this._locations = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._locations = [];
			}
		} else {
			this._locations = [];
		}
		return this._locations;
	}

	private saveLocations(): void {
		this.ensureDir();
		fs.writeFileSync(
			path.join(this.dataDir, 'locations.json'),
			JSON.stringify(this._locations ?? [], null, 2),
			'utf-8',
		);
	}

	private loadEvents(): WorldEvent[] {
		if (this._events) return this._events;
		const fp = path.join(this.dataDir, 'events.json');
		if (fs.existsSync(fp)) {
			try {
				this._events = JSON.parse(fs.readFileSync(fp, 'utf-8'));
			} catch {
				this._events = [];
			}
		} else {
			this._events = [];
		}
		return this._events;
	}

	private saveEvents(): void {
		this.ensureDir();
		fs.writeFileSync(
			path.join(this.dataDir, 'events.json'),
			JSON.stringify(this._events ?? [], null, 2),
			'utf-8',
		);
	}

	getFactions(): Faction[] {
		return this.loadFactions();
	}

	getFaction(id: string): Faction {
		const f = this.loadFactions().find((x) => x.id === id);
		if (!f) throw new Error(`Faction not found: ${id}`);
		return f;
	}

	addFaction(input: Omit<Faction, 'id'>): Faction {
		const f: Faction = { ...input, id: uid() };
		this._factions = this.loadFactions();
		this._factions.push(f);
		this.saveFactions();
		return f;
	}

	updateFaction(id: string, updates: Partial<Faction>): Faction {
		const list = this.loadFactions();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Faction not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._factions = list;
		this.saveFactions();
		return list[idx];
	}

	removeFaction(id: string): void {
		this._factions = this.loadFactions().filter((x) => x.id !== id);
		this.saveFactions();
	}

	getLocations(): Location[] {
		return this.loadLocations();
	}

	getLocation(id: string): Location {
		const l = this.loadLocations().find((x) => x.id === id);
		if (!l) throw new Error(`Location not found: ${id}`);
		return l;
	}

	addLocation(input: Omit<Location, 'id'>): Location {
		const l: Location = { ...input, id: uid() };
		this._locations = this.loadLocations();
		this._locations.push(l);
		this.saveLocations();
		return l;
	}

	updateLocation(id: string, updates: Partial<Location>): Location {
		const list = this.loadLocations();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Location not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._locations = list;
		this.saveLocations();
		return list[idx];
	}

	removeLocation(id: string): void {
		this._locations = this.loadLocations().filter((x) => x.id !== id);
		this.saveLocations();
	}

	getEvents(): WorldEvent[] {
		return this.loadEvents();
	}

	getEvent(id: string): WorldEvent {
		const e = this.loadEvents().find((x) => x.id === id);
		if (!e) throw new Error(`Event not found: ${id}`);
		return e;
	}

	addEvent(input: Omit<WorldEvent, 'id'>): WorldEvent {
		const e: WorldEvent = { ...input, id: uid() };
		this._events = this.loadEvents();
		this._events.push(e);
		this.saveEvents();
		return e;
	}

	updateEvent(id: string, updates: Partial<WorldEvent>): WorldEvent {
		const list = this.loadEvents();
		const idx = list.findIndex((x) => x.id === id);
		if (idx < 0) throw new Error(`Event not found: ${id}`);
		list[idx] = { ...list[idx], ...updates, id };
		this._events = list;
		this.saveEvents();
		return list[idx];
	}

	removeEvent(id: string): void {
		this._events = this.loadEvents().filter((x) => x.id !== id);
		this.saveEvents();
	}

	getAll(): { factions: Faction[]; locations: Location[]; events: WorldEvent[] } {
		return {
			factions: this.getFactions(),
			locations: this.getLocations(),
			events: this.getEvents(),
		};
	}
}
