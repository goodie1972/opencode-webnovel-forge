import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

// ─── 1. 模块导入 ────────────────────────────────────────────────

import { NovelProjectManager } from '../../src/novel/project';
import type { CreateProjectInput } from '../../src/novel/project';
import { WorldService } from '../../src/novel/world';
import { CharacterService } from '../../src/novel/character';
import { PlotService } from '../../src/novel/plot';
import { ShuangPointTracker } from '../../src/novel/shuang';
import { PacingAnalyzer } from '../../src/novel/pacing';
import { ForeshadowingManager } from '../../src/novel/foreshadowing';
import { MemoryService } from '../../src/novel/memory';
import { WorkflowStateMachine } from '../../src/novel/workflow';
import { WORKFLOW_STAGES, WORKFLOW_LABELS } from '../../src/novel/types';
import { handleNovelCommand } from '../../src/commands/novel';

// ─── 2. 模拟命令 ────────────────────────────────────────────────

async function novel(...args: string[]): Promise<string> {
	return handleNovelCommand(args, testDir);
}

// ─── 3. 测试基础设施 ─────────────────────────────────────────────

let testDir: string;

beforeAll(() => {
	testDir = path.join(tmpdir(), `novel_e2e_${Date.now()}`);
	fs.mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
	fs.rmSync(testDir, { recursive: true, force: true });
});

// ─── 4. E2E 测试 ────────────────────────────────────────────────

describe('E2E: /novel commands', () => {
	it('[1/9] /novel — shows help with project list', async () => {
		const output = await novel();
		expect(output).toContain('/novel model');
		expect(output).toContain('/novel prompt');
		expect(output).toContain('/novel master');
		expect(output).toContain('/novel status');
		expect(output).toContain('/novel active');
		console.log('  ✓ 帮助信息完整');
	});

	it('[2/9] /novel model list — lists all 14 agents', async () => {
		const output = await novel('model', 'list');
		expect(output).toContain('editor_in_chief');
		expect(output).toContain('writer_a');
		expect(output).toContain('writer_b');
		expect(output).toContain('writer_c');
		expect(output).toContain('world_builder');
		expect(output).toContain('character_designer');
		expect(output).toContain('plot_architect');
		expect(output).toContain('shuang_analyzer');
		expect(output).toContain('pacing_reviewer');
		expect(output).toContain('genre_checker');
		expect(output).toContain('reader_simulator');
		expect(output).toContain('copy_editor');
		expect(output).toContain('research_market');
		expect(output).toContain('research_deep');
		console.log('  ✓ 14 个 Agent 全部列出');
	});

	it('[3/9] /novel model init — lists available presets', async () => {
		const output = await novel('model', 'init');
		expect(output).toContain('plan-a');
		expect(output).toContain('plan-b');
		expect(output).toContain('plan-c');
		console.log('  ✓ 3 个预设可见');
	});

	it('[4/9] /novel prompt list — lists all prompt names', async () => {
		const output = await novel('prompt', 'list');
		expect(output).toContain('editor-in-chief');
		expect(output).toContain('writer-a');
		console.log('  ✓ 提示词列表正常 (14个)');
	});

	it('[5/9] /novel prompt path — shows agent prompt file', async () => {
		const output = await novel('prompt', 'path', 'editor_in_chief');
		expect(output).toContain('editor-in-chief');
		expect(output).toContain('.json');
		console.log('  ✓ 提示词路径正确');
	});

	it('[6/9] /novel master list — lists 10 masters', async () => {
		const output = await novel('master', 'list');
		expect(output).toContain('辰东');
		expect(output).toContain('唐家三少');
		expect(output).toContain('猫腻');
		expect(output).toContain('紫金陈');
		const match = output.match(/\*\*(\d+)\*\*/);
		expect(match).not.toBeNull();
		console.log(`  ✓ 大师文风列表正常 (${match?.[1] || '?'} 种)`);
	});

	it('[7/9] /novel master show — shows master detail', async () => {
		const output = await novel('master', 'show', '辰东流');
		expect(output).toContain('辰东');
		expect(output).toContain('世界观');
		console.log('  ✓ 大师详情正确');
	});
});

describe('E2E: 创建项目 + 章节管理', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
	});

	it('[8/9] 创建项目', () => {
		const result = pm.create({
			title: '仙帝重生',
			author: '测试作者',
			genre: '修仙/玄幻',
			tags: ['重生', '修炼', '热血'],
			description: '一代仙帝重生回到少年时代，重新踏上修仙之路',
			targetWords: 100000,
		});
		dirName = result.dirName;
		expect(result.project.meta.title).toBe('仙帝重生');
		expect(result.project.meta.genre).toBe('修仙/玄幻');
		expect(result.project.chapters).toHaveLength(0);
		console.log(`  ✓ 项目 "${result.project.meta.title}" 创建成功 (${dirName})`);
	});

	it('添加 10 个章节', () => {
		const chapters = [
			'重生归来', '再入宗门', '灵根觉醒', '突破筑基', '秘境探宝',
			'初遇宿敌', '丹道大会', '天劫降临', '仙魔之战', '飞升之路',
		];
		for (const title of chapters) {
			pm.addChapter(dirName, title);
		}
		const project = pm.load(dirName);
		expect(project.chapters).toHaveLength(10);
		expect(project.chapters[0].index).toBe(1);
		expect(project.chapters[0].title).toBe('重生归来');
		expect(project.chapters[9].title).toBe('飞升之路');
		console.log('  ✓ 10 个章节添加成功');
	});

	it('写入章节内容并计算字数', () => {
		for (let i = 0; i < 10; i++) {
			const content = '第' + (i + 1) + '章内容。'.repeat(100 + i * 20);
			const project = pm.load(dirName);
			pm.writeChapterContent(dirName, project.chapters[i].id, content);
		}
		const project = pm.load(dirName);
		const totalWords = project.chapters.reduce((s, c) => s + c.wordCount, 0);
		expect(totalWords).toBeGreaterThan(1000);
		console.log(`  ✓ 章节内容写入完成，总字数: ${totalWords}`);
	});

	it('更新章节状态', () => {
		const project = pm.load(dirName);
		pm.updateChapter(dirName, project.chapters[0].id, { status: 'final' });
		pm.updateChapter(dirName, project.chapters[1].id, { status: 'final' });
		pm.updateChapter(dirName, project.chapters[2].id, { status: 'revising' });
		const updated = pm.load(dirName);
		const finalCount = updated.chapters.filter((c) => c.status === 'final').length;
		expect(finalCount).toBe(2);
		console.log(`  ✓ 章节状态更新: ${finalCount} 章已完成`);
	});

	it('重排序章节', () => {
		const project = pm.load(dirName);
		const ids = project.chapters.map((c) => c.id);
		const reversed = [...ids].reverse();
		pm.reorderChapters(dirName, reversed);
		const reordered = pm.load(dirName);
		expect(reordered.chapters[0].title).toBe('飞升之路');
		expect(reordered.chapters[9].title).toBe('重生归来');
		console.log('  ✓ 章节重排序成功');
	});

	it('项目列表正确', () => {
		const list = pm.listProjects();
		expect(list.length).toBeGreaterThanOrEqual(1);
		const found = list.find((p) => p.dirName === dirName);
		expect(found).toBeDefined();
		expect(found!.meta.title).toBe('仙帝重生');
		console.log('  ✓ 项目列表包含新项目');
	});

	it('/novel status 显示项目信息', async () => {
		const output = await novel('status', dirName);
		expect(output).toContain('仙帝重生');
		expect(output).toContain('修仙/玄幻');
		expect(output).toContain('100,000');
		expect(output).toContain('10 章');
		console.log('  ✓ /novel status 显示完整');
	});

	it('/novel active 切换并显示活动项目', async () => {
		const active = await novel('active', dirName);
		expect(active).toContain('仙帝重生');

		const query = await novel('active');
		expect(query).toContain('仙帝重生');
		console.log('  ✓ /novel active 正常');
	});
});

describe('E2E: 世界观 — WorldService', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '世界观测试', author: '测试', genre: '玄幻' }).dirName;
	});

	it('创建势力', () => {
		const ws = new WorldService(pm, dirName);
		const f1 = ws.addFaction({ name: '青云门', description: '正道修仙门派', goals: ['维护正道', '培养弟子'], members: ['掌门', '长老'], power: 85 });
		const f2 = ws.addFaction({ name: '魔教', description: '邪道势力', goals: ['统治修仙界'], members: ['教主', '护法'], power: 90 });
		const f3 = ws.addFaction({ name: '散修联盟', description: '散修组织', goals: ['资源共享'], members: [], power: 40 });
		expect(ws.getFactions()).toHaveLength(3);
		console.log('  ✓ 3 个势力创建成功');
	});

	it('创建地点', () => {
		const ws = new WorldService(pm, dirName);
		const l1 = ws.addLocation({ name: '青云山', description: '青云门驻地，灵气充沛', type: 'mountain', parentId: undefined });
		const l2 = ws.addLocation({ name: '魔渊', description: '魔教总部', type: 'abyss' });
		const l3 = ws.addLocation({ name: '灵药谷', description: '盛产灵药', type: 'valley' });
		expect(ws.getLocations()).toHaveLength(3);
		console.log('  ✓ 3 个地点创建成功');
	});

	it('创建历史事件', () => {
		const ws = new WorldService(pm, dirName);
		ws.addEvent({ title: '仙魔大战', description: '千年前的正邪大战', era: '上古', year: -1000, impact: '改变了修仙界格局' });
		ws.addEvent({ title: '天书现世', description: '上古天书重现人间', era: '近代', year: -100, impact: '引发各方争夺' });
		expect(ws.getEvents()).toHaveLength(2);
		console.log('  ✓ 2 个历史事件创建成功');
	});

	it('getAll 返回全部数据', () => {
		const ws = new WorldService(pm, dirName);
		const all = ws.getAll();
		expect(all.factions.length).toBeGreaterThanOrEqual(3);
		expect(all.locations.length).toBeGreaterThanOrEqual(3);
		expect(all.events.length).toBeGreaterThanOrEqual(2);
		console.log('  ✓ getAll 返回完整世界观数据');
	});
});

describe('E2E: 角色 — CharacterService', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '角色测试', author: '测试', genre: '都市' }).dirName;
	});

	it('创建主角和配角', () => {
		const cs = new CharacterService(pm, dirName);
		cs.addCharacter({ name: '林云', role: 'protagonist', aliases: ['小林'], traits: ['坚毅', '聪明', '重情义'], background: '普通家庭出身，偶得奇遇', goal: '成为最强', arc: '从平凡到巅峰', voice: '沉稳有力' });
		cs.addCharacter({ name: '苏婉清', role: 'love_interest', aliases: [], traits: ['温柔', '坚强'], background: '大家族千金', goal: '守护家族', arc: '从依赖到独立', voice: '柔和' });
		cs.addCharacter({ name: '赵无极', role: 'villain', aliases: ['赵老魔'], traits: ['阴险', '强大'], background: '魔道巨擘', goal: '统治世界', arc: '从幕后到台前', voice: '低沉阴冷' });
		cs.addCharacter({ name: '王老', role: 'mentor', aliases: [], traits: ['睿智', '神秘'], background: '隐世高人', goal: '培养传人', arc: '', voice: '苍老' });
		cs.addCharacter({ name: '李四', role: 'side', aliases: [], traits: ['忠诚'], background: '主角好友', goal: '帮助主角', arc: '', voice: '直爽' });
		expect(cs.getCharacters()).toHaveLength(5);
		console.log('  ✓ 5 个角色创建成功');
	});

	it('按角色筛选', () => {
		const cs = new CharacterService(pm, dirName);
		expect(cs.getCharactersByRole('protagonist')).toHaveLength(1);
		expect(cs.getCharactersByRole('villain')).toHaveLength(1);
		expect(cs.getCharactersByRole('supporting').length + cs.getCharactersByRole('side').length).toBe(1);
		console.log('  ✓ 角色筛选正常');
	});

	it('建立角色关系', () => {
		const cs = new CharacterService(pm, dirName);
		const chars = cs.getCharacters();
		const hero = chars.find((c) => c.role === 'protagonist')!;
		const love = chars.find((c) => c.role === 'love_interest')!;
		const villain = chars.find((c) => c.role === 'villain')!;
		const mentor = chars.find((c) => c.role === 'mentor')!;

		cs.addRelationship(hero.id, { targetId: love.id, type: '恋人', description: '青梅竹马' });
		cs.addRelationship(hero.id, { targetId: mentor.id, type: '师徒', description: '授业恩师' });
		cs.addRelationship(villain.id, { targetId: hero.id, type: '宿敌', description: '生死大敌' });

		const heroReloaded = cs.getCharacter(hero.id);
		expect(heroReloaded.relationships).toHaveLength(2);
		console.log('  ✓ 角色关系建立成功');
	});
});

describe('E2E: 情节 + 大纲 — PlotService', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '情节测试', author: '测试', genre: '玄幻' }).dirName;
	});

	it('创建情节弧', () => {
		const ps = new PlotService(pm, dirName);
		ps.addArc({ title: '觉醒篇', phase: 1, summary: '主角重生觉醒，重新开始修炼' });
		ps.addArc({ title: '崛起篇', phase: 2, summary: '主角快速成长，崭露头角' });
		ps.addArc({ title: '争霸篇', phase: 3, summary: '主角参与仙魔大战' });
		ps.addArc({ title: '飞升篇', phase: 4, summary: '主角飞升上界' });
		expect(ps.getArcs()).toHaveLength(4);
		console.log('  ✓ 4 条情节弧创建成功');
	});

	it('创建章节大纲和场景', () => {
		for (let i = 0; i < 5; i++) {
			const ch = pm.addChapter(dirName, `第${i + 1}章`);
			const ps = new PlotService(pm, dirName);
			ps.upsertOutline(ch.id, {
				scenes: [
					{ id: `s${i}_1`, summary: `场景${i + 1}-1`, pov: '主角', wordEstimate: 500, purpose: 'setup' as const },
					{ id: `s${i}_2`, summary: `场景${i + 1}-2`, pov: '主角', wordEstimate: 800, purpose: 'conflict' as const },
					{ id: `s${i}_3`, summary: `场景${i + 1}-3`, pov: '主角', wordEstimate: 600, purpose: 'resolution' as const },
				],
				tensionStart: 0.2,
				tensionEnd: 0.9,
			});
		}
		const project = pm.load(dirName);
		const ps = new PlotService(pm, dirName);
		const outline = ps.getOutline(project.chapters[0].id);
		expect(outline).toBeDefined();
		expect(outline!.scenes).toHaveLength(3);
		console.log('  ✓ 5 章大纲 + 15 个场景创建成功');
	});

	it('创建子情节', () => {
		const ps = new PlotService(pm, dirName);
		ps.addSubplot({ name: '爱情线', description: '主角与女主的感情发展', relatedArc: 'arc1', status: 'active' });
		ps.addSubplot({ name: '身世之谜', description: '主角的身世秘密', relatedArc: 'arc2', status: 'active' });
		expect(ps.getSubplots()).toHaveLength(2);
		console.log('  ✓ 2 条子情节创建成功');
	});
});

describe('E2E: 爽点 — ShuangPointTracker', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '爽点测试', author: '测试', genre: '玄幻' }).dirName;
	});

	it('在不同章节布设爽点', () => {
		const st = new ShuangPointTracker(pm, dirName);
		const ch1 = pm.addChapter(dirName, '觉醒');
		const ch2 = pm.addChapter(dirName, '打脸');
		const ch3 = pm.addChapter(dirName, '突破');
		const ch4 = pm.addChapter(dirName, '决战');

		st.addPoint({ chapterId: ch1.id, type: 'face_slap', description: '主角觉醒打脸反派', intensity: 7, targetWordRange: [500, 1000] });
		st.addPoint({ chapterId: ch2.id, type: 'face_slap', description: '宗门大比打脸', intensity: 8, targetWordRange: [1000, 1500] });
		st.addPoint({ chapterId: ch2.id, type: 'secret_reveal', description: '主角真实身份揭露', intensity: 9, targetWordRange: [2000, 2500] });
		st.addPoint({ chapterId: ch3.id, type: 'breakthrough', description: '突破筑基期', intensity: 9, targetWordRange: [300, 800] });
		st.addPoint({ chapterId: ch4.id, type: 'showdown', description: '最终对决', intensity: 10, targetWordRange: [4000, 5000] });

		expect(st.getPoints()).toHaveLength(5);
		console.log('  ✓ 5 个爽点布设成功');
	});

	it('爽点密度统计', () => {
		const st = new ShuangPointTracker(pm, dirName);
		const stats = st.getStats();
		expect(stats.total).toBe(5);
		expect(stats.byType['face_slap']).toBe(2);
		expect(stats.avgIntensity).toBeGreaterThan(0);
		console.log(`  ✓ 爽点统计: 共${stats.total}个, 均强度${stats.avgIntensity}`);
	});

	it('标记爽点已放置并查看放置率', () => {
		const st = new ShuangPointTracker(pm, dirName);
		const points = st.getPoints();
		points.slice(0, 3).forEach((p) => st.markPlaced(p.id));
		const stats = st.getStats();
		expect(stats.placementRate).toBeCloseTo(3 / 5, 2);
		console.log(`  ✓ 爽点放置率: ${(stats.placementRate * 100).toFixed(0)}%`);
	});
});

describe('E2E: 节奏分析 — PacingAnalyzer', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '节奏测试', author: '测试', genre: '玄幻' }).dirName;
	});

	it('分析章节节奏', () => {
		const pa = new PacingAnalyzer(pm, dirName);
		const ch = pm.addChapter(dirName, '第一章');
		const content = '「你好。」他说道。然后他冲了过去，一刀砍下。敌人躲闪不及，被一刀斩杀。\n\n' +
			'「就这？」他冷笑一声。四周的观众都惊呆了。\n\n' +
			'他转身离开，留下一个背影。';

		const profile = pa.computeProfile(ch.id, content);
		pa.upsertProfile(profile);

		expect(profile.totalWords).toBeGreaterThan(0);
		expect(profile.readabilityScore).toBeGreaterThanOrEqual(0);
		expect(profile.tensionCurve).toHaveLength(5);
		expect(profile.dialogueRatio).toBeGreaterThan(0);
		expect(profile.actionRatio).toBeGreaterThan(0);

		const loaded = pa.getProfile(ch.id);
		expect(loaded).toBeDefined();
		expect(loaded!.chapterId).toBe(ch.id);
		console.log(`  ✓ 节奏分析完成: ${profile.totalWords}字, 可读性${profile.readabilityScore}`);
	});
});

describe('E2E: 伏笔 — ForeshadowingManager', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '伏笔测试', author: '测试', genre: '悬疑' }).dirName;
	});

	it('埋设伏笔', () => {
		const fm = new ForeshadowingManager(pm, dirName);
		const ch1 = pm.addChapter(dirName, '第一章 神秘的玉佩');

		fm.addEntry({ description: '主角捡到的玉佩实际上封印着上古大能的灵魂', category: 'item', plantAt: { chapterId: ch1.id, detail: '主角在古董摊买到一块奇怪的玉佩' }, importance: 9 });
		fm.addEntry({ description: '主角的身世和千年前的仙魔大战有关', category: 'character', plantAt: { chapterId: ch1.id, detail: '主角做梦梦到战场' }, importance: 8 });
		fm.addEntry({ description: '宗门藏经阁有秘密', category: 'mystery', plantAt: { chapterId: ch1.id, detail: '主角路过藏经阁感到奇怪的气息' }, importance: 5 });

		expect(fm.getEntries()).toHaveLength(3);
		expect(fm.getActiveEntries()).toHaveLength(3);
		console.log('  ✓ 3 个伏笔埋设成功');
	});

	it('回收伏笔', () => {
		const fm = new ForeshadowingManager(pm, dirName);
		const ch10 = pm.addChapter(dirName, '第十章 玉佩觉醒');

		const entries = fm.getEntries();
		fm.setPayoff(entries[0].id, { chapterId: ch10.id, detail: '玉佩中的灵魂觉醒，帮助主角突破' });

		expect(fm.getPaidOffEntries()).toHaveLength(1);
		expect(fm.getActiveEntries()).toHaveLength(2);
		console.log('  ✓ 伏笔回收成功，剩余 2 个活跃伏笔');
	});

	it('伏笔统计', () => {
		const fm = new ForeshadowingManager(pm, dirName);
		const stats = fm.getStats();
		expect(stats.total).toBe(3);
		expect(stats.paidOff).toBe(1);
		expect(stats.unpaid).toBe(2);
		console.log(`  ✓ 伏笔统计: 共${stats.total}个, 已回收${stats.paidOff}个`);
	});
});

describe('E2E: 记忆库 — MemoryService', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '记忆测试', author: '测试', genre: '玄幻' }).dirName;
	});

	it('添加事实', () => {
		const ms = new MemoryService(pm, dirName);
		ms.addFact({ fact: '主角林云今年18岁', category: 'character', source: '人设', tags: ['年龄', '主角'] });
		ms.addFact({ fact: '青云门位于青云山', category: 'location', source: '设定', tags: ['门派', '地点'] });
		ms.addFact({ fact: '修仙境界: 练气→筑基→金丹→元婴→化神', category: 'lore', source: '设定', tags: ['境界'] });
		ms.addFact({ fact: '林云是林家的私生子', category: 'character', source: '大纲', tags: ['身世'] });

		expect(ms.getFacts()).toHaveLength(4);
		console.log('  ✓ 4 条事实添加成功');
	});

	it('搜索事实', () => {
		const ms = new MemoryService(pm, dirName);
		expect(ms.searchFacts('林云')).toHaveLength(2);
		expect(ms.searchFacts('境界')).toHaveLength(1);
		console.log('  ✓ 事实搜索正常');
	});

	it('标记确认', () => {
		const ms = new MemoryService(pm, dirName);
		const facts = ms.getFacts();
		facts.forEach((f) => ms.confirmFact(f.id));
		const stats = ms.getStats();
		expect(stats.confirmed).toBe(4);
		expect(stats.unconfirmed).toBe(0);
		console.log('  ✓ 全部事实已确认');
	});
});

describe('E2E: 6阶段工作流 — WorkflowStateMachine', () => {
	it('从世界观构建到精修的完整流转', () => {
		const wf = new WorkflowStateMachine();

		expect(wf.currentStage).toBe('world_building');
		expect(wf.currentLabel).toBe('世界观构建');
		expect(wf.progress).toBeCloseTo(1 / 6, 5);

		wf.advance(); // → character_design
		expect(wf.currentStage).toBe('character_design');
		expect(wf.currentLabel).toBe('角色设计');

		wf.advance(); // → outline
		expect(wf.currentStage).toBe('outline');
		expect(wf.currentLabel).toBe('大纲创作');

		wf.advance(); // → first_draft
		expect(wf.currentStage).toBe('first_draft');
		expect(wf.currentLabel).toBe('初稿');
		expect(wf.progress).toBeCloseTo(4 / 6, 5);

		wf.advance(); // → revision
		expect(wf.currentStage).toBe('revision');
		expect(wf.currentLabel).toBe('修改');

		wf.advance(); // → polish
		expect(wf.currentStage).toBe('polish');
		expect(wf.currentLabel).toBe('精修');

		wf.advance(); // → done
		expect(wf.isComplete).toBeTrue();

		console.log('  ✓ 6 阶段工作流完整流转: 世界观构建 → 精修 → 完成');
	});

	it('序列化/反序列化状态保持', () => {
		const wf = new WorkflowStateMachine();
		wf.advance();
		wf.advance();
		wf.setStageData('world_building', 'worldName', '修仙世界');
		wf.setStageData('character_design', 'protagonist', '林云');
		wf.setStageData('outline', 'totalChapters', 100);

		const data = wf.serialize();
		const restored = WorkflowStateMachine.deserialize(data);

		expect(restored.currentStage).toBe('outline');
		expect(restored.getStageData('world_building', 'worldName')).toBe('修仙世界');
		expect(restored.getStageData('character_design', 'protagonist')).toBe('林云');
		expect(restored.getStageData<number>('outline', 'totalChapters')).toBe(100);
		expect(restored.history).toHaveLength(3);
		console.log('  ✓ 工作流状态序列化/反序列化正常');
	});

	it('非法流转被拒绝', () => {
		const wf = new WorkflowStateMachine();
		expect(wf.canTransitionTo('polish').allowed).toBeFalse();
		const result = wf.transitionTo('polish');
		expect(result.success).toBeFalse();
		console.log('  ✓ 非法跳转被正确拒绝');
	});
});

describe('E2E: /novel write 写作管线', () => {
	let pm: NovelProjectManager;
	let dirName = '';

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
		dirName = pm.create({ title: '写作管线测试', author: '测试', genre: '玄幻', targetWords: 50000 }).dirName;
	});

	it('/novel — help 包含 write', async () => {
		const output = await novel();
		expect(output).toContain('/novel write');
		console.log('  ✓ 帮助信息包含 write 命令');
	});

	it('WritingSession.create 创建会话文件', async () => {
		const { WritingSession } = await import('../../src/writer/session');
		const ws = await WritingSession.create(testDir, dirName, { mode: 'semi-auto' });
		expect(ws).toBeDefined();
		expect(ws.projectDir).toBe(dirName);
		const sessionPath = path.join(testDir, 'novels', dirName, '.writing-session.json');
		expect(fs.existsSync(sessionPath)).toBe(true);
		console.log('  ✓ 写作会话文件已创建');
	});

	it('/novel write --abort 清除会话文件', async () => {
		const output = await novel('write', '--abort', dirName);
		expect(output).toContain('已中止');
		const sessionPath = path.join(testDir, 'novels', dirName, '.writing-session.json');
		expect(fs.existsSync(sessionPath)).toBe(false);
		console.log('  ✓ 会话文件已清除');
	});

	it('/novel write --confirm 提示无会话', async () => {
		const output = await novel('write', '--confirm', dirName);
		expect(output).toContain('无进行中的写作会话');
		console.log('  ✓ 无会话时正确提示');
	});
});

describe('E2E: 清理 — 删除项目', () => {
	let pm: NovelProjectManager;

	beforeAll(() => {
		pm = new NovelProjectManager(testDir);
	});

	it('删除所有测试项目', () => {
		const projects = pm.listProjects();
		console.log(`  ➜ 清理 ${projects.length} 个测试项目...`);
		for (const p of projects) {
			pm.delete(p.dirName);
		}
		expect(pm.listProjects()).toHaveLength(0);
		console.log('  ✓ 所有测试项目已删除');
	});
});
