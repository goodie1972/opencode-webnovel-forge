/**
 * Writing Pipeline 全流程模拟测试
 *
 * 模拟 6 个写作阶段，使用 mock agent 返回虚拟内容。
 *
 * 运行方式（隔离执行，避免 vi.mock 泄漏）：
 *   bun test tests/simulation/pipeline-simulation.test.ts --timeout 60000
 */
import { test, expect, vi, beforeAll, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';

vi.mock('../../src/writer/agent-runtime', () => ({
  callAgent: vi.fn((opts: { agentName: string; userMessage: string; masterStyle?: string }) => {
    const agentName = opts.agentName;

    const mockContents: Record<string, string> = {
      world_builder: [
        'Factions:',
        '  - name: 青云门',
        '    description: 正道修仙门派',
        '  - name: 魔教',
        '    description: 邪道势力',
        'Locations:',
        '  - name: 青云山',
        '    type: mountain',
        '  - name: 魔渊',
        '    type: abyss',
      ].join('\n'),
      character_designer: [
        'Characters:',
        '  - name: 林云',
        '    role: protagonist',
        '    traits: [坚毅, 聪明]',
        '    goal: 成为最强',
        '  - name: 苏婉清',
        '    role: love_interest',
        '    traits: [温柔]',
        '    goal: 守护家族',
      ].join('\n'),
      outliner: [
        'Plot Arcs:',
        '  - title: 觉醒篇',
        '    summary: 主角重生觉醒',
        '  - title: 崛起篇',
        '    summary: 主角快速成长',
        'Chapters:',
        '  - title: 重生归来',
        '    scenes: [觉醒, 测试灵根, 初入宗门]',
        '  - title: 初露锋芒',
        '    scenes: [宗门大比, 获得奇遇]',
      ].join('\n'),
      first_draft_writer: [
        '# 第一章 重生归来',
        '',
        '林云缓缓睁开眼睛，看到的是熟悉又陌生的天花板。',
        '"我...回来了？"他喃喃自语，脑海中还残留着上一世的记忆。',
        '',
        '他坐起身来，环顾四周。',
        '这是林家外院的杂物间，他在这里度过了十六年。',
        '',
        '"这一世，我不会再重蹈覆辙。"',
        '他握紧拳头，眼中闪过一丝坚定的光芒。',
        '',
        '今日，正是林家测试灵根的日子。',
        '上一世他因紧张只测出废灵根，被家族抛弃。',
        '但这一次，他有了前世百年的修行记忆。',
      ].join('\n'),
      first_draft_reviewer: 'Length: adequate. Style: consistent. No issues found.',
      revision_editor: [
        '# 第一章 重生归来（修订版）',
        '',
        '林云缓缓睁开双眼。',
        '',
        '天花板上那道细长的裂缝，和记忆中一模一样。',
        '他回来了。',
        '',
        '"我...回来了？"他的声音很轻。',
        '但记忆中的痛楚如此真实——被逐出家族，漂泊天涯，最终在飞升天劫下灰飞烟灭。',
        '',
        '他坐起身，目光扫过不足十平米的杂物间。',
        '墙角的蛛网，桌上半凉的茶，窗外透进来的晨光。',
        '',
        '今日，是林家灵根测试的日子。',
        '这一世，他要拿回属于他的一切。',
      ].join('\n'),
      polisher: [
        '# 第一章 重生归来（精修版）',
        '',
        '林云缓缓睁开双眼。',
        '',
        '天花板那道细长的裂缝，和记忆中分毫不差。',
        '他回来了。',
        '',
        '"我...回来了？"呢喃很轻，像怕惊碎梦境。',
        '但记忆中的痛楚如此真实——被逐出家族，漂泊天涯，',
        '在尸山血海中杀出一条路，最终在飞升天劫下灰飞烟灭。',
        '',
        '他缓缓坐起，目光扫过这间不足十平米的杂物间。',
        '墙角的蛛网，桌上半凉的茶，窗外透进来的晨光——',
        '一切都在告诉他：他真的回来了。',
        '',
        '今日是林家灵根测试的日子。',
        '上一世，他因紧张发挥失常，测得废灵根，从此被家族抛弃。',
        '但这一世——',
        '他拥有了前世百年的修行记忆。',
        '',
        '这一世，他要拿回属于他的一切。',
      ].join('\n'),
    };

    const content = mockContents[agentName] ?? `${agentName} output at ${Date.now()}`;
    return { content, model: 'gpt-4o-mock', tokensUsed: content.length, durationMs: 80 + Math.random() * 40 };
  }),
}));

import { WritingSession } from '../../src/writer/session';
import { NovelProjectManager } from '../../src/novel/project';
import { WORKFLOW_STAGES, WORKFLOW_LABELS } from '../../src/novel/types';

const sourceDir = path.resolve(import.meta.dirname, '../..');
let testDir: string;
let dirName: string;
let pm: NovelProjectManager;
let cleanupDirs: string[] = [];

beforeAll(() => {
  testDir = path.join(tmpdir(), `pipeline_sim_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  cleanupDirs.push(testDir);
  pm = new NovelProjectManager(testDir);

  const project = pm.create({
    title: '仙帝重生',
    author: '测试作者',
    genre: '修仙/玄幻',
    tags: ['重生', '修炼', '热血'],
    description: '一代仙帝重生回到少年时代',
    targetWords: 100000,
  });
  dirName = project.dirName;
});

afterAll(() => {
  for (const dir of cleanupDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ }
  }
});

test('完整管线模拟：6 阶段全流程', async () => {
  const session = await WritingSession.create(testDir, dirName, { mode: 'semi-auto' });
  expect(session).toBeDefined();
  expect(session.projectDir).toBe(dirName);

  let status = session.getStatus();
  expect(status.currentStage).toBe('world_building');
  expect(status.isComplete).toBe(false);

  const allStageNames = WORKFLOW_STAGES;
  const allStageLabels = allStageNames.map(s => WORKFLOW_LABELS[s]);

  for (let i = 0; i < allStageNames.length; i++) {
    const expectedStage = allStageNames[i];
    const expectedLabel = allStageLabels[i];

    status = session.getStatus();
    expect(status.currentStage).toBe(expectedStage);
    expect(status.stageLabel).toBe(expectedLabel);

    const result = await session.runCurrentStage();
    expect(result.stageName).toBe(expectedStage);
    expect(result.output).toBeTruthy();
    expect(result.output.length).toBeGreaterThan(50);
    expect(result.tokensUsed).toBeGreaterThan(0);

    console.log(`  ✓ [${i + 1}/6] ${expectedLabel}: ${result.output.length} 字符, ${result.tokensUsed} tokens`);

    if (i < allStageNames.length - 1) {
      const advance = await session.advanceStage();
      expect(advance.success).toBe(true);
    }
  }

  // Final advance to 'done'
  const finalAdvance = await session.advanceStage();
  expect(finalAdvance.success).toBe(true);

  status = session.getStatus();
  expect(status.isComplete).toBe(true);
  expect(status.progress).toBe(1);
  expect(status.currentStage).toBe('done');

  console.log(`\n  ✅ 全线完成：6 阶段全部通过`);

  // Verify session file
  const sessionPath = path.join(testDir, 'novels', dirName, '.writing-session.json');
  expect(fs.existsSync(sessionPath)).toBe(true);
  const saved = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  expect(saved.workflow.currentStage).toBe('done');
  expect(saved.workflow.stageHistory.length).toBe(6);
  expect(saved.workflow.stageHistory.map((s: any) => s.stage)).toEqual(allStageNames);

  // Verify quality reports
  const reportsDir = path.join(testDir, 'novels', dirName, 'quality-reports');
  expect(fs.existsSync(reportsDir)).toBe(true);
  const reports = fs.readdirSync(reportsDir);
  expect(reports.length).toBe(6);
  console.log(`  ℹ  ${reports.length} 个质检报告已保存`);

  // Verify report IDs
  for (const report of reports) {
    const data = JSON.parse(fs.readFileSync(path.join(reportsDir, report), 'utf-8'));
    expect(data.id).toBeTruthy();
    expect(data.timestamp).toBeTruthy();
    expect(data.dimensions).toBeTruthy();
  }
  console.log(`  ℹ  所有报告含 id / timestamp 字段`);
});
