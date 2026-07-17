import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChapterControlCard, DynamicState } from './types';

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export function generateControlCard(
  chapterIndex: number,
  title: string,
  context: unknown,
  state: DynamicState,
): ChapterControlCard {
  const linesToAdvance = Object.entries(state.plotlineProgress)
    .filter(([_, p]) => p.status === 'active')
    .map(([name]) => name);

  const debtsToReturn = state.emotionalDebts.slice(0, 3);

  const mission = linesToAdvance.length > 0
    ? `推进 ${linesToAdvance.join('、')}，解决当前核心冲突`
    : '推动情节发展';

  return {
    chapterIndex,
    title,
    mission,
    linesToAdvance,
    debtsToReturn,
    conflict: '核心冲突待确定',
    endingResidue: '制造下一章的牵引力',
    characterStateChanges: [],
  };
}

export function saveControlCard(
  projectsDir: string,
  projectName: string,
  card: ChapterControlCard,
): string {
  const cardsDir = path.join(projectsDir, projectName, 'control-cards');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });
  const filename = `${String(card.chapterIndex).padStart(2, '0')}-${slugify(card.title)}.json`;
  const filePath = path.join(cardsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2), 'utf-8');
  return filePath;
}

export function loadControlCard(
  projectsDir: string,
  projectName: string,
  chapterIndex: number,
): ChapterControlCard | null {
  const cardsDir = path.join(projectsDir, projectName, 'control-cards');
  if (!fs.existsSync(cardsDir)) return null;

  const files = fs.readdirSync(cardsDir)
    .filter(f => f.startsWith(`${String(chapterIndex).padStart(2, '0')}-`))
    .sort();

  if (files.length === 0) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(cardsDir, files[0]), 'utf-8'));
  } catch {
    return null;
  }
}

export function listControlCards(
  projectsDir: string,
  projectName: string,
): ChapterControlCard[] {
  const cardsDir = path.join(projectsDir, projectName, 'control-cards');
  if (!fs.existsSync(cardsDir)) return [];
  return fs.readdirSync(cardsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(cardsDir, f), 'utf-8')); }
      catch { return null; }
    })
    .filter((c): c is ChapterControlCard => c !== null);
}