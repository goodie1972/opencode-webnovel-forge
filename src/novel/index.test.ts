import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { NovelProjectManager } from './project';
import { WorldService } from './world';
import { CharacterService } from './character';
import { PlotService } from './plot';
import { ShuangPointTracker } from './shuang';
import { PacingAnalyzer } from './pacing';
import { ForeshadowingManager } from './foreshadowing';
import { MemoryService } from './memory';
import { WorkflowStateMachine } from './workflow';
import { WORKFLOW_STAGES, WORKFLOW_LABELS } from './types';

let tmpDir: string;
let pm: NovelProjectManager;

function freshProject(): string {
	const name = `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
	const result = pm.create({ title: `测试项目${name}`, author: '测试作者', genre: '玄幻', targetWords: 10000 });
	return result.dirName;
}

function createProject(title: string): string {
	const result = pm.create({ title, author: '作者', genre: '玄幻' });
	return result.dirName;
}

beforeEach(() => {
	tmpDir = path.join(tmpdir(), `novel_test_${Date.now()}`);
	fs.mkdirSync(tmpDir, { recursive: true });
	pm = new NovelProjectManager(tmpDir);
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── NovelProjectManager ───────────────────────────────────────

describe('NovelProjectManager', () => {
	it('should create a project with metadata', () => {
		const result = pm.create({ title: '我的小说', author: '作者', genre: '都市' });
		expect(result.project.meta.title).toBe('我的小说');
		expect(result.project.meta.author).toBe('作者');
		expect(result.project.meta.genre).toBe('都市');
		expect(result.project.meta.targetWords).toBe(100000);
		expect(result.project.chapters).toEqual([]);
		expect(result.dirName).toBeTruthy();
	});

	it('should save and load a project', () => {
		const name = freshProject();
		const loaded = pm.load(name);
		expect(loaded.meta.title).toContain('测试项目');
	});

	it('should list all projects', () => {
		freshProject();
		freshProject();
		const list = pm.listProjects();
		expect(list.length).toBeGreaterThanOrEqual(2);
	});

	it('should add chapters', () => {
		const name = freshProject();
		const c1 = pm.addChapter(name, '第一章');
		expect(c1.index).toBe(1);
		expect(c1.title).toBe('第一章');
		expect(c1.status).toBe('draft');

		const c2 = pm.addChapter(name, '第二章');
		expect(c2.index).toBe(2);
	});

	it('should update chapter status', () => {
		const name = freshProject();
		const c = pm.addChapter(name, '第一章');
		const updated = pm.updateChapter(name, c.id, { status: 'final' });
		expect(updated.status).toBe('final');
	});

	it('should remove and reorder chapters', () => {
		const name = freshProject();
		const c1 = pm.addChapter(name, '第一章');
		const c2 = pm.addChapter(name, '第二章');
		const c3 = pm.addChapter(name, '第三章');

		pm.removeChapter(name, c2.id);

		const project = pm.load(name);
		expect(project.chapters).toHaveLength(2);
		expect(project.chapters[0].index).toBe(1);
		expect(project.chapters[1].index).toBe(2);
	});

	it('should write and read chapter content', () => {
		const name = freshProject();
		const c = pm.addChapter(name, '第一章');
		pm.writeChapterContent(name, c.id, '测试内容');
		const content = pm.readChapterContent(name, c.id);
		expect(content).toBe('测试内容');

		const project = pm.load(name);
		const chapter = project.chapters.find((ch) => ch.id === c.id);
		expect(chapter?.wordCount).toBe(4);
	});

	it('should reorder chapters', () => {
		const name = freshProject();
		const c1 = pm.addChapter(name, 'A');
		const c2 = pm.addChapter(name, 'B');
		const c3 = pm.addChapter(name, 'C');

		pm.reorderChapters(name, [c3.id, c1.id, c2.id]);
		const project = pm.load(name);
		expect(project.chapters[0].title).toBe('C');
		expect(project.chapters[1].title).toBe('A');
		expect(project.chapters[2].title).toBe('B');
	});

	it('should delete a project', () => {
		const name = freshProject();
		pm.delete(name);
		expect(pm.listProjects().find((p) => p.dirName === name)).toBeUndefined();
	});
});

// ─── WorldService ──────────────────────────────────────────────

describe('WorldService', () => {
	it('should manage factions', () => {
		const name = freshProject();
		const ws = new WorldService(pm, name);
		const f = ws.addFaction({ name: '青云门', description: '修仙门派', goals: ['称霸'], members: ['张三'], power: 80 });
		expect(f.id).toBeTruthy();
		expect(ws.getFaction(f.id).name).toBe('青云门');

		ws.updateFaction(f.id, { power: 90 });
		expect(ws.getFaction(f.id).power).toBe(90);

		ws.removeFaction(f.id);
		expect(ws.getFactions()).toHaveLength(0);
	});

	it('should manage locations', () => {
		const name = freshProject();
		const ws = new WorldService(pm, name);
		const l = ws.addLocation({ name: '青云山', description: '主峰', type: 'mountain' });
		expect(ws.getLocation(l.id).name).toBe('青云山');
		ws.removeLocation(l.id);
		expect(ws.getLocations()).toHaveLength(0);
	});

	it('should manage events', () => {
		const name = freshProject();
		const ws = new WorldService(pm, name);
		const e = ws.addEvent({ title: '仙魔大战', description: '大战', era: '上古', year: -1000, impact: 'high' });
		expect(ws.getEvent(e.id).title).toBe('仙魔大战');
	});

	it('should return all data', () => {
		const name = freshProject();
		const ws = new WorldService(pm, name);
		ws.addFaction({ name: 'F', description: '', goals: [], members: [], power: 0 });
		ws.addLocation({ name: 'L', description: '', type: '' });
		const all = ws.getAll();
		expect(all.factions).toHaveLength(1);
		expect(all.locations).toHaveLength(1);
	});
});

// ─── CharacterService ──────────────────────────────────────────

describe('CharacterService', () => {
	it('should add and retrieve characters', () => {
		const name = freshProject();
		const cs = new CharacterService(pm, name);
		const c = cs.addCharacter({ name: '林枫', role: 'protagonist', aliases: [], traits: ['勇敢'], background: '孤儿', goal: '成仙', arc: '成长', voice: '坚定' });
		expect(cs.getCharacter(c.id).name).toBe('林枫');
	});

	it('should update characters', () => {
		const name = freshProject();
		const cs = new CharacterService(pm, name);
		const c = cs.addCharacter({ name: '林枫', role: 'protagonist', aliases: [], traits: ['勇敢'], background: '', goal: '', arc: '', voice: '' });
		cs.updateCharacter(c.id, { goal: '飞升' });
		expect(cs.getCharacter(c.id).goal).toBe('飞升');
	});

	it('should manage relationships', () => {
		const name = freshProject();
		const cs = new CharacterService(pm, name);
		const a = cs.addCharacter({ name: 'A', role: 'protagonist', aliases: [], traits: [], background: '', goal: '', arc: '', voice: '' });
		const b = cs.addCharacter({ name: 'B', role: 'love_interest', aliases: [], traits: [], background: '', goal: '', arc: '', voice: '' });
		cs.addRelationship(a.id, { targetId: b.id, type: '恋人', description: '情侣' });
		expect(cs.getCharacter(a.id).relationships).toHaveLength(1);
		cs.removeRelationship(a.id, b.id);
		expect(cs.getCharacter(a.id).relationships).toHaveLength(0);
	});

	it('should filter by role', () => {
		const name = freshProject();
		const cs = new CharacterService(pm, name);
		cs.addCharacter({ name: '英雄', role: 'protagonist', aliases: [], traits: [], background: '', goal: '', arc: '', voice: '' });
		cs.addCharacter({ name: '反派', role: 'villain', aliases: [], traits: [], background: '', goal: '', arc: '', voice: '' });
		expect(cs.getCharactersByRole('protagonist')).toHaveLength(1);
		expect(cs.getCharactersByRole('villain')).toHaveLength(1);
	});
});

// ─── PlotService ───────────────────────────────────────────────

describe('PlotService', () => {
	it('should manage arcs', () => {
		const name = freshProject();
		const ps = new PlotService(pm, name);
		const a = ps.addArc({ title: '觉醒篇', phase: 1, summary: '主角觉醒' });
		expect(ps.getArc(a.id).title).toBe('觉醒篇');
		ps.updateArc(a.id, { status: 'writing' });
		expect(ps.getArc(a.id).status).toBe('writing');
	});

	it('should manage outlines', () => {
		const name = freshProject();
		const ps = new PlotService(pm, name);
		const ch = pm.addChapter(name, '第一章');
		const outline = ps.upsertOutline(ch.id, { scenes: [{ id: 's1', summary: '开场', pov: '主角', wordEstimate: 500, purpose: 'setup' }], tensionStart: 0.2, tensionEnd: 0.8 });
		expect(outline.chapterId).toBe(ch.id);
		expect(ps.getOutline(ch.id)?.scenes).toHaveLength(1);
		ps.removeOutline(ch.id);
		expect(ps.getOutline(ch.id)).toBeUndefined();
	});

	it('should manage subplots', () => {
		const name = freshProject();
		const ps = new PlotService(pm, name);
		const s = ps.addSubplot({ name: '爱情线', description: '男女主感情', relatedArc: 'arc1', status: 'active' });
		expect(ps.getSubplots()).toHaveLength(1);
		ps.updateSubplot(s.id, { status: 'resolved' });
		expect(ps.getSubplots()[0].status).toBe('resolved');
	});
});

// ─── ShuangPointTracker ────────────────────────────────────────

describe('ShuangPointTracker', () => {
	it('should add and track shuang points', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const st = new ShuangPointTracker(pm, name);
		const p = st.addPoint({ chapterId: ch.id, type: 'face_slap', description: '打脸反派', intensity: 8, targetWordRange: [1000, 2000] });
		expect(st.getPointsByChapter(ch.id)).toHaveLength(1);

		st.markPlaced(p.id);
		expect(st.getPoints()[0].placed).toBeTrue();
	});

	it('should compute stats', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const st = new ShuangPointTracker(pm, name);
		st.addPoint({ chapterId: ch.id, type: 'breakthrough', description: '突破', intensity: 9, targetWordRange: [500, 1000] });
		st.addPoint({ chapterId: ch.id, type: 'face_slap', description: '打脸', intensity: 7, targetWordRange: [1500, 2000] });
		const stats = st.getStats();
		expect(stats.total).toBe(2);
		expect(stats.avgIntensity).toBe(8);
	});

	it('should compute chapter density', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const st = new ShuangPointTracker(pm, name);
		st.addPoint({ chapterId: ch.id, type: 'face_slap', description: '', intensity: 5, targetWordRange: [0, 100] });
		const d = st.getChapterDensity(ch.id);
		expect(d.count).toBe(1);
		expect(d.types).toContain('face_slap');
	});
});

// ─── PacingAnalyzer ────────────────────────────────────────────

describe('PacingAnalyzer', () => {
	it('should compute a profile from content', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const pa = new PacingAnalyzer(pm, name);
		const profile = pa.computeProfile(ch.id, '「你好」他说。然后他冲了过去，一刀砍下。');
		expect(profile.totalWords).toBeGreaterThan(0);
		expect(profile.readabilityScore).toBeGreaterThanOrEqual(0);
		expect(profile.tensionCurve).toHaveLength(5);
	});

	it('should upsert and retrieve profiles', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const pa = new PacingAnalyzer(pm, name);
		const p = pa.computeProfile(ch.id, '测试内容');
		pa.upsertProfile(p);
		expect(pa.getProfile(ch.id)?.chapterId).toBe(ch.id);
	});

	it('should compute chapter stats', () => {
		const name = freshProject();
		const pa = new PacingAnalyzer(pm, name);
		const stats = pa.getChapterStats();
		expect(stats.totalChapters).toBe(0);
	});
});

// ─── ForeshadowingManager ──────────────────────────────────────

describe('ForeshadowingManager', () => {
	it('should add and pay off foreshadowing', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const ch2 = pm.addChapter(name, '第十章');
		const fm = new ForeshadowingManager(pm, name);
		const e = fm.addEntry({ description: '神秘玉佩', category: 'item', plantAt: { chapterId: ch.id, detail: '主角捡到玉佩' }, importance: 8 });
		expect(fm.getEntries()).toHaveLength(1);
		expect(fm.getActiveEntries()).toHaveLength(1);

		fm.setPayoff(e.id, { chapterId: ch2.id, detail: '玉佩觉醒' });
		expect(fm.getPaidOffEntries()).toHaveLength(1);
		expect(fm.getActiveEntries()).toHaveLength(0);
	});

	it('should compute stats', () => {
		const name = freshProject();
		const ch = pm.addChapter(name, '第一章');
		const fm = new ForeshadowingManager(pm, name);
		fm.addEntry({ description: '伏笔1', category: 'plot', plantAt: { chapterId: ch.id, detail: '' }, importance: 5 });
		fm.addEntry({ description: '伏笔2', category: 'character', plantAt: { chapterId: ch.id, detail: '' }, importance: 3 });
		const stats = fm.getStats();
		expect(stats.total).toBe(2);
		expect(stats.unpaid).toBe(2);
	});
});

// ─── MemoryService ──────────────────────────────────────────────

describe('MemoryService', () => {
	it('should add and confirm facts', () => {
		const name = freshProject();
		const ms = new MemoryService(pm, name);
		const f = ms.addFact({ fact: '主角年龄18岁', category: 'character', source: '大纲', tags: ['年龄'] });
		expect(ms.getFacts()).toHaveLength(1);
		ms.confirmFact(f.id);
		expect(ms.getFacts()[0].confirmed).toBeTrue();
	});

	it('should search facts', () => {
		const name = freshProject();
		const ms = new MemoryService(pm, name);
		ms.addFact({ fact: '主角住在青云山', category: 'location', source: '设定', tags: ['地点'] });
		ms.addFact({ fact: '反派叫李四', category: 'character', source: '设定', tags: ['反派'] });
		expect(ms.searchFacts('青云')).toHaveLength(1);
		expect(ms.searchFacts('反派')).toHaveLength(1);
	});

	it('should detect contradictions', () => {
		const name = freshProject();
		const ms = new MemoryService(pm, name);
		ms.addFact({ fact: '主角18岁', category: 'character', source: 'A', tags: [] });
		ms.addFact({ fact: '主角30岁', category: 'character', source: 'B', tags: [] });
		ms.addFact({ fact: '世界是平的', category: 'lore', source: 'C', tags: [] });
		const contradictions = ms.getContradictions();
		expect(contradictions.length).toBeGreaterThanOrEqual(1);
	});
});

// ─── WorkflowStateMachine ──────────────────────────────────────

describe('WorkflowStateMachine', () => {
	it('should start at world_building', () => {
		const wf = new WorkflowStateMachine();
		expect(wf.currentStage).toBe('world_building');
		expect(wf.currentLabel).toBe('世界观构建');
	});

	it('should advance through all stages', () => {
		const wf = new WorkflowStateMachine();
		for (const stage of WORKFLOW_STAGES) {
			expect(wf.currentStage).toBe(stage);
			wf.advance();
		}
		expect(wf.isComplete).toBeTrue();
	});

	it('should reject invalid transitions', () => {
		const wf = new WorkflowStateMachine();
		const result = wf.canTransitionTo('polish');
		expect(result.allowed).toBeFalse();
	});

	it('should allow sequential transitions', () => {
		const wf = new WorkflowStateMachine();
		expect(wf.canTransitionTo('character_design').allowed).toBeTrue();
		wf.transitionTo('character_design');
		expect(wf.currentStage).toBe('character_design');
	});

	it('should track progress', () => {
		const wf = new WorkflowStateMachine();
		expect(wf.progress).toBeCloseTo(1 / 6, 5);
		wf.advance();
		expect(wf.progress).toBeCloseTo(2 / 6, 5);
	});

	it('should serialize and deserialize', () => {
		const wf = new WorkflowStateMachine();
		wf.advance();
		wf.advance();
		wf.setStageData('world_building', 'worldName', '修仙界');
		const data = wf.serialize();
		const restored = WorkflowStateMachine.deserialize(data);
		expect(restored.currentStage).toBe(wf.currentStage);
		expect(restored.history).toHaveLength(3);
		expect(restored.getStageData<string>('world_building', 'worldName')).toBe('修仙界');
	});

	it('should get stage requirements', () => {
		const wf = new WorkflowStateMachine();
		const req = wf.getRequirements();
		expect(req.stage).toBe('world_building');
		expect(req.requiredServices).toContain('world');
	});

	it('should return status info', () => {
		const wf = new WorkflowStateMachine();
		const s = wf.getStatus();
		expect(s.label).toBe('世界观构建');
		expect(s.index).toBe(0);
		expect(s.total).toBe(6);
		expect(s.isComplete).toBeFalse();
	});

	it('should handle advance from last stage to done', () => {
		const wf = new WorkflowStateMachine();
		WORKFLOW_STAGES.forEach(() => wf.advance());
		expect(wf.isComplete).toBeTrue();
		const result = wf.advance();
		expect(result.success).toBeFalse();
	});
});
