import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NovelProjectManager } from '../../../../src/novel/project';
import { WorldService } from '../../../../src/novel/world';
import { CharacterService } from '../../../../src/novel/character';
import { PlotService } from '../../../../src/novel/plot';
import { ForeshadowingManager } from '../../../../src/novel/foreshadowing';
import { ShuangPointTracker } from '../../../../src/novel/shuang';
import { buildAgentContext } from '../../../../src/writer/context/assemble';

const TMP = path.join(process.cwd(), '.test_context_tmp');

describe('buildAgentContext - enriched data', () => {
  let pm: NovelProjectManager;
  let dirName: string;
  let chId: string;

  beforeEach(() => {
    if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true });
    pm = new NovelProjectManager(TMP);
    const created = pm.create({ title: 'test_project', author: 'test_author', genre: 'xianxia' });
    dirName = created.dirName;

    pm.addChapter(dirName, 'chapter_1');
    pm.addChapter(dirName, 'chapter_2');
    pm.addChapter(dirName, 'chapter_3');
    pm.addChapter(dirName, 'chapter_4');
    pm.writeChapterContent(dirName, created.project.chapters[0].id, 'content_1');
    pm.writeChapterContent(dirName, created.project.chapters[1].id, 'content_2_longer');
    pm.writeChapterContent(dirName, created.project.chapters[2].id, 'content_3');
    pm.writeChapterContent(dirName, created.project.chapters[3].id, 'content_4');

    const world = new WorldService(pm, dirName);
    world.addFaction({ name: 'faction_a', description: 'desc', goals: ['goal1'], members: [], power: 90 });
    world.addFaction({ name: 'faction_b', description: 'desc', goals: ['goal2'], members: [], power: 80 });
    world.addLocation({ name: 'loc_a', description: 'desc', type: 'mountain' });
    world.addLocation({ name: 'loc_b', description: 'desc', type: 'valley' });
    world.addEvent({ title: 'event_1', description: 'desc', era: 'ancient', year: 1000, impact: 'high' });

    const chars = new CharacterService(pm, dirName);
    chars.addCharacter({ name: 'hero', role: 'protagonist', aliases: [], traits: ['brave', 'smart'], background: 'hero_background', goal: 'ascend', arc: 'hero_arc', voice: 'hero_voice' });
    const chars2 = new CharacterService(pm, dirName);
    chars2.addCharacter({ name: 'villain', role: 'villain', aliases: [], traits: ['cruel'], background: 'villain_background', goal: 'rule', arc: 'villain_arc', voice: 'villain_voice' });

    const plot = new PlotService(pm, dirName);
    plot.addArc({ title: 'arc_1', summary: 'main story', phase: 2 });
    plot.addSubplot({ name: 'sub_1', description: 'side story', relatedArc: 'arc_1', status: 'active' });

    const fm = new ForeshadowingManager(pm, dirName);
    chId = created.project.chapters[0].id;
    fm.addEntry({ description: '神秘玉佩', category: 'item', importance: 8, plantAt: { chapterId: chId, detail: '发现玉佩' } });
    fm.addEntry({ description: '师尊秘密', category: 'character', importance: 5, plantAt: { chapterId: chId, detail: '师尊身份可疑' } });

    const st = new ShuangPointTracker(pm, dirName);
    st.addPoint({ chapterId: chId, type: 'face_slap', description: '打脸反派', intensity: 7, targetWordRange: [500, 1000] });
    st.addPoint({ chapterId: chId, type: 'breakthrough', description: '突破境界', intensity: 9, targetWordRange: [500, 1000] });

    const novelsDir = path.join(TMP, 'novels');
    const projectDir = path.join(novelsDir, dirName);
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'context.md'), 'this is context memo', 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true });
  });

  it('loads project meta', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.projectMeta.title).toBe('test_project');
    expect(ctx.projectMeta.author).toBe('test_author');
    expect(ctx.totalChapters).toBe(4);
    expect(ctx.totalWords).toBeGreaterThan(0);
  });

  it('reads recent chapters', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.recentChapters.length).toBe(4);
    expect(ctx.recentChapters[0].title).toBe('chapter_1');
    expect(ctx.recentChapters[0].content).toBe('content_1');
  });

  it('limits recent chapters count', async () => {
    const ctx = await buildAgentContext(pm, dirName, { recentChapterCount: 2 });
    expect(ctx.recentChapters.length).toBe(2);
    expect(ctx.recentChapters[1].title).toBe('chapter_4');
  });

  it('loads world summary with detailed faction and location data', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.worldSummary.factions).toBe(2);
    expect(ctx.worldSummary.locations).toBe(2);
    expect(ctx.worldSummary.events).toBe(1);
    expect(ctx.worldSummary.factionNames).toContain('faction_a');
    expect(ctx.worldSummary.locationNames).toContain('loc_a');
    
    expect(ctx.worldSummary.factionDetails).toBeDefined();
    expect(ctx.worldSummary.factionDetails.length).toBe(2);
    expect(ctx.worldSummary.factionDetails[0].name).toBe('faction_a');
    expect(ctx.worldSummary.factionDetails[0].description).toBe('desc');
    expect(ctx.worldSummary.factionDetails[0].goals).toContain('goal1');
    expect(ctx.worldSummary.factionDetails[0].power).toBe(90);
    expect(ctx.worldSummary.factionDetails[0].memberCount).toBe(0);
    
    expect(ctx.worldSummary.locationDetails).toBeDefined();
    expect(ctx.worldSummary.locationDetails.length).toBe(2);
    expect(ctx.worldSummary.locationDetails[0].name).toBe('loc_a');
    expect(ctx.worldSummary.locationDetails[0].description).toBe('desc');
    expect(ctx.worldSummary.locationDetails[0].type).toBe('mountain');
  });

  it('loads characters with enriched data (background, arc, voice, relationships)', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.characters.length).toBe(2);
    expect(ctx.characters[0].name).toBe('hero');
    expect(ctx.characters[0].role).toBe('protagonist');
    expect(ctx.characters[0].traits).toContain('brave');
    expect(ctx.characters[0].goal).toBe('ascend');
    expect(ctx.characters[0].background).toBe('hero_background');
    expect(ctx.characters[0].arc).toBe('hero_arc');
    expect(ctx.characters[0].voice).toBe('hero_voice');
    expect(ctx.characters[0].relationships).toBeDefined();
    expect(ctx.characters[0].relationships.length).toBe(0);
  });

  it('resolves relationship targetId to character name', async () => {
    const chars = new CharacterService(pm, dirName);
    const c1 = chars.addCharacter({ name: 'rel_test_a', role: 'protagonist', aliases: [], traits: ['x'], background: 'b', goal: 'g', arc: 'a', voice: 'v' });
    const c2 = chars.addCharacter({ name: 'rel_test_b', role: 'side', aliases: [], traits: ['y'], background: 'b', goal: 'g', arc: 'a', voice: 'v' });
    chars.addRelationship(c1.id, { targetId: c2.id, type: 'rival', description: '死对头' });
    const ctx = await buildAgentContext(pm, dirName);
    const testA = ctx.characters.find(c => c.name === 'rel_test_a');
    expect(testA).toBeDefined();
    expect(testA!.relationships.length).toBe(1);
    expect(testA!.relationships[0].targetName).toBe('rel_test_b');
    expect(testA!.relationships[0].type).toBe('rival');
    expect(testA!.relationships[0].description).toBe('死对头');
  });

  it('loads plot arcs with phase and chapterCount', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.plotArcs.length).toBe(1);
    expect(ctx.plotArcs[0].title).toBe('arc_1');
    expect(ctx.plotArcs[0].phase).toBe(2);
    expect(ctx.plotArcs[0].chapterCount).toBe(0);
  });

  it('loads subplots with relatedArc', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.subplots.length).toBe(1);
    expect(ctx.subplots[0].name).toBe('sub_1');
    expect(ctx.subplots[0].relatedArc).toBe('arc_1');
  });

  it('loads active foreshadowing with status, plantAt', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.activeForeshadowing.length).toBe(2);
    expect(ctx.activeForeshadowing[0].description).toBe('神秘玉佩');
    expect(ctx.activeForeshadowing[0].importance).toBe(8);
    expect(ctx.activeForeshadowing[0].category).toBe('item');
    expect(ctx.activeForeshadowing[0].status).toBe('planted');
    expect(ctx.activeForeshadowing[0].plantAt).toEqual({ chapterId: chId, detail: '发现玉佩' });
  });

  it('loads shuang stats', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.shuangStats.total).toBe(2);
    expect(ctx.shuangStats.byType['face_slap']).toBe(1);
    expect(ctx.shuangStats.avgIntensity).toBe(8);
  });

  it('loads contextMemo from file', async () => {
    const ctx = await buildAgentContext(pm, dirName);
    expect(ctx.contextMemo).toBe('this is context memo');
  });

  it('returns empty arrays for missing directories', async () => {
    const created = pm.create({ title: 'empty_project', author: 'anon', genre: 'urban' });
    const ctx = await buildAgentContext(pm, created.dirName);
    expect(ctx.characters).toEqual([]);
    expect(ctx.plotArcs).toEqual([]);
    expect(ctx.subplots).toEqual([]);
    expect(ctx.activeForeshadowing).toEqual([]);
    expect(ctx.shuangStats.total).toBe(0);
    expect(ctx.contextMemo).toBe('');
    
    expect(ctx.worldSummary.factionDetails).toEqual([]);
    expect(ctx.worldSummary.locationDetails).toEqual([]);
  });

  it('throws for non-existent project', async () => {
    expect(buildAgentContext(pm, '不存在的项目')).rejects.toThrow();
  });
});
