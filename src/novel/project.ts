import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
	NovelMeta,
	ChapterMeta,
	ChapterStatus,
	NovelSettings,
} from './types';

const PROJECTS_DIR = 'novels';

export interface CreateProjectInput {
	title: string;
	author: string;
	genre: string;
	tags?: string[];
	description?: string;
	targetWords?: number;
}

export interface CreateProjectResult {
	dirName: string;
	project: ProjectData;
}

export interface ProjectData {
	meta: NovelMeta;
	chapters: ChapterMeta[];
	settings: NovelSettings;
}

function now(): string {
	return new Date().toISOString();
}

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class NovelProjectManager {
	private baseDir: string;
	private cache = new Map<string, ProjectData>();

	constructor(workspaceRoot: string) {
		this.baseDir = path.join(workspaceRoot, PROJECTS_DIR);
	}

	get projectsDir(): string {
		return this.baseDir;
	}

	// ─── Project CRUD ─────────────────────────────────────────────

	create(input: CreateProjectInput): CreateProjectResult {
		const dirName = input.title
			.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '')
			.toLowerCase()
			.slice(0, 64) || `project_${uid().slice(0, 8)}`;

		const projectDir = path.join(this.baseDir, dirName);
		if (fs.existsSync(projectDir)) {
			throw new Error(`Project directory already exists: ${dirName}`);
		}

		const project: ProjectData = {
			meta: {
				title: input.title,
				author: input.author,
				genre: input.genre,
				tags: input.tags ?? [],
				description: input.description ?? '',
				targetWords: input.targetWords ?? 100000,
				createdAt: now(),
				updatedAt: now(),
			},
			chapters: [],
			settings: {
				language: 'zh',
				agentOverrides: {},
			},
		};

		fs.mkdirSync(projectDir, { recursive: true });
		this.writeProject(projectDir, project);
		this.cache.set(dirName, project);
		return { dirName, project };
	}

	load(dirName: string): ProjectData {
		const cached = this.cache.get(dirName);
		if (cached) return cached;

		const projectDir = path.join(this.baseDir, dirName);
		if (!fs.existsSync(projectDir)) {
			throw new Error(`Project not found: ${dirName}`);
		}

		const project = this.readProject(projectDir);
		this.cache.set(dirName, project);
		return project;
	}

	save(dirName: string, project: ProjectData): void {
		project.meta.updatedAt = now();
		const projectDir = path.join(this.baseDir, dirName);
		this.writeProject(projectDir, project);
		this.cache.set(dirName, project);
	}

	listProjects(): { dirName: string; meta: NovelMeta }[] {
		if (!fs.existsSync(this.baseDir)) return [];

		const results: { dirName: string; meta: NovelMeta }[] = [];
		for (const entry of fs.readdirSync(this.baseDir)) {
			const projectDir = path.join(this.baseDir, entry);
			if (!fs.statSync(projectDir).isDirectory()) continue;
			const metaPath = path.join(projectDir, 'meta.json');
			if (!fs.existsSync(metaPath)) continue;
			try {
				const meta: NovelMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
				results.push({ dirName: entry, meta });
			} catch {
				continue;
			}
		}
		return results.sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
	}

	delete(dirName: string): void {
		const projectDir = path.join(this.baseDir, dirName);
		if (!fs.existsSync(projectDir)) {
			throw new Error(`Project not found: ${dirName}`);
		}
		fs.rmSync(projectDir, { recursive: true, force: true });
		this.cache.delete(dirName);
	}

	// ─── Chapter management ───────────────────────────────────────

	addChapter(dirName: string, title: string): ChapterMeta {
		const project = this.load(dirName);
		const chapter: ChapterMeta = {
			id: uid(),
			title,
			index: project.chapters.length + 1,
			wordCount: 0,
			status: 'draft',
			createdAt: now(),
			updatedAt: now(),
		};
		project.chapters.push(chapter);
		this.save(dirName, project);
		return chapter;
	}

	updateChapter(dirName: string, chapterId: string, updates: Partial<ChapterMeta>): ChapterMeta {
		const project = this.load(dirName);
		const idx = project.chapters.findIndex((c) => c.id === chapterId);
		if (idx < 0) throw new Error(`Chapter not found: ${chapterId}`);
		project.chapters[idx] = { ...project.chapters[idx], ...updates, id: chapterId, updatedAt: now() };
		this.save(dirName, project);
		return project.chapters[idx];
	}

	removeChapter(dirName: string, chapterId: string): void {
		const project = this.load(dirName);
		const idx = project.chapters.findIndex((c) => c.id === chapterId);
		if (idx < 0) throw new Error(`Chapter not found: ${chapterId}`);
		project.chapters.splice(idx, 1);
		project.chapters.forEach((c, i) => (c.index = i + 1));
		this.save(dirName, project);
	}

	reorderChapters(dirName: string, chapterIds: string[]): ChapterMeta[] {
		const project = this.load(dirName);
		const ordered = chapterIds
			.map((id) => project.chapters.find((c) => c.id === id))
			.filter((c): c is ChapterMeta => c !== undefined);

		if (ordered.length !== project.chapters.length) {
			throw new Error('Chapter ID list does not match project chapters');
		}

		ordered.forEach((c, i) => {
			c.index = i + 1;
			c.updatedAt = now();
		});
		project.chapters = ordered;
		this.save(dirName, project);
		return project.chapters;
	}

	getChapter(dirName: string, chapterId: string): ChapterMeta {
		const project = this.load(dirName);
		const c = project.chapters.find((ch) => ch.id === chapterId);
		if (!c) throw new Error(`Chapter not found: ${chapterId}`);
		return c;
	}

	getChapterContentPath(dirName: string, chapterId: string): string {
		return path.join(this.baseDir, dirName, 'chapters', `${chapterId}.md`);
	}

	writeChapterContent(dirName: string, chapterId: string, content: string): void {
		const project = this.load(dirName);
		const idx = project.chapters.findIndex((c) => c.id === chapterId);
		if (idx < 0) throw new Error(`Chapter not found: ${chapterId}`);
		const dir = path.join(this.baseDir, dirName, 'chapters');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, `${chapterId}.md`), content, 'utf-8');
		const wc = content.length;
		project.chapters[idx].wordCount = wc;
		project.chapters[idx].updatedAt = now();
		this.save(dirName, project);
	}

	readChapterContent(dirName: string, chapterId: string): string {
		const cp = this.getChapterContentPath(dirName, chapterId);
		if (!fs.existsSync(cp)) return '';
		return fs.readFileSync(cp, 'utf-8');
	}

	// ─── Private helpers ──────────────────────────────────────────

	private projectPath(dirName: string): string {
		return path.join(this.baseDir, dirName);
	}

	private writeProject(projectDir: string, project: ProjectData): void {
		if (!fs.existsSync(projectDir)) {
			fs.mkdirSync(projectDir, { recursive: true });
		}
		const { meta, chapters, settings } = project;
		fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
		fs.writeFileSync(path.join(projectDir, 'chapters.json'), JSON.stringify(chapters, null, 2), 'utf-8');
		fs.writeFileSync(path.join(projectDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8');
	}

	private readProject(projectDir: string): ProjectData {
		const meta: NovelMeta = JSON.parse(
			fs.readFileSync(path.join(projectDir, 'meta.json'), 'utf-8'),
		);
		const chapters: ChapterMeta[] = JSON.parse(
			fs.readFileSync(path.join(projectDir, 'chapters.json'), 'utf-8'),
		);
		const settingsPath = path.join(projectDir, 'settings.json');
		const settings: NovelSettings = fs.existsSync(settingsPath)
			? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
			: { language: 'zh', agentOverrides: {} };
		return { meta, chapters, settings };
	}
}
