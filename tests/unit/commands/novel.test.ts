import { test, expect, beforeEach, afterAll } from 'bun:test';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { handleNovelCommand } from '../../../src/commands/novel';
import { NovelProjectManager } from '../../../src/novel/project';

let testDir: string;

beforeEach(() => {
  testDir = path.join(tmpdir(), `novel_cmd_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(testDir, { recursive: true });
});

function novel(...args: string[]): Promise<string> {
  return handleNovelCommand(args, testDir);
}

test('/novel write without args shows available projects', async () => {
  const output = await novel('write');
  expect(output).toContain('暂无小说项目');
});

test('/novel write with non-existent project shows error', async () => {
  const output = await novel('write', 'nonexistent');
  expect(output).toContain('创建写作会话失败');
});

test('/novel write --continue on non-existent session shows error', async () => {
  const pm = new NovelProjectManager(testDir);
  const project = pm.create({
    title: 'Continue Test',
    author: 'Author',
    genre: 'xianxia',
    tags: [],
    description: '',
    targetWords: 100000,
  });

  const output = await novel('write', '--continue', project.dirName);
  expect(output).toContain('无保存的会话');
});

test('/novel write --confirm without running session shows error', async () => {
  const pm = new NovelProjectManager(testDir);
  const project = pm.create({
    title: 'Confirm Test',
    author: 'Author',
    genre: 'xianxia',
    tags: [],
    description: '',
    targetWords: 100000,
  });

  const output = await novel('write', '--confirm', project.dirName);
  expect(output).toContain('无进行中的写作会话');
});

test('/novel write --abort without session shows error', async () => {
  const pm = new NovelProjectManager(testDir);
  const project = pm.create({
    title: 'Abort Test',
    author: 'Author',
    genre: 'xianxia',
    tags: [],
    description: '',
    targetWords: 100000,
  });

  const output = await novel('write', '--abort', project.dirName);
  expect(output).toContain('无进行中的写作会话');
});

test('/novel help lists write subcommand', async () => {
  const output = await novel();
  expect(output).toContain('/novel write');
});

test('WritingSession.create creates session file directly', async () => {
  const pm = new NovelProjectManager(testDir);
  const project = pm.create({
    title: 'Session Create Test',
    author: 'Author',
    genre: 'xianxia',
    tags: [],
    description: '',
    targetWords: 100000,
  });

  const { WritingSession } = await import('../../../src/writer/session');
  const ws = await WritingSession.create(testDir, project.dirName, { mode: 'semi-auto' });
  expect(ws.projectDir).toBe(project.dirName);

  const sessionPath = path.join(testDir, 'novels', project.dirName, '.writing-session.json');
  expect(fs.existsSync(sessionPath)).toBe(true);
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  expect(sessionData.config.mode).toBe('semi-auto');
});

test('WritingSession.resume loads existing session', async () => {
  const pm = new NovelProjectManager(testDir);
  const project = pm.create({
    title: 'Resume Test',
    author: 'Author',
    genre: 'xianxia',
    tags: [],
    description: '',
    targetWords: 100000,
  });

  const { WritingSession } = await import('../../../src/writer/session');
  await WritingSession.create(testDir, project.dirName, { mode: 'semi-auto' });

  const resumed = await WritingSession.resume(testDir, project.dirName);
  expect(resumed).not.toBeNull();
  expect(resumed!.projectDir).toBe(project.dirName);
});
