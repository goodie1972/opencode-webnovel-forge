import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChapterControlCard, CharacterStateChange, DynamicState } from './types';

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

function inferEmotionalState(role: string, arc: string, status: string): string {
  if (status === 'missing' || status === 'retired') return '未知';
  if (role === 'antagonist') return arc.includes('downfall') ? '急躁' : '冷静但有威胁';
  if (arc.includes('growth') || arc.includes('redemption')) return '内心挣扎，渴望改变';
  if (arc.includes('downfall') || arc.includes('tragedy')) return '焦虑，日渐消沉';
  return '平静';
}

function inferDevelopment(arc: string, lastStatus?: string): string {
  if (!arc) return '待发展';
  if (lastStatus && lastStatus === 'active') return `${arc} — 持续推进`;
  return `${arc} — 开始新阶段`;
}

interface CtxShape {
  characters?: { name: string; role: string; arc: string; voice: string; goal: string; background?: string; relationships?: { targetName: string; type: string; description: string }[] }[];
  plotArcs?: { title: string; summary: string; status: string; phase: number; chapterCount: number }[];
  activeForeshadowing?: { description: string; importance: number; category: string; status: string; plantAt?: { chapterId: string; detail: string }; payoffAt?: { chapterId: string; detail: string } }[];
  subplots?: { name: string; description: string; status: string; relatedArc: string }[];
  contextMemo?: string;
}

function inferConflict(ctx: CtxShape, chapterIndex: number, characters: { name: string; role: string; goal: string }[]): string {
  // Active plot arcs — highest priority
  const activeArcs = (ctx.plotArcs || []).filter(a => a.status === 'active');
  if (activeArcs.length > 0) {
    const primary = activeArcs[0];
    const phaseDesc = primary.phase <= 1 ? '开头' : primary.phase <= 2 ? '发展' : '高潮';
    return `【${primary.title}】${phaseDesc}阶段 — ${primary.summary.slice(0, 80)}`;
  }

  // Active subplots
  const activeSubplots = (ctx.subplots || []).filter(s => s.status === 'active');
  if (activeSubplots.length > 0) {
    return `支线冲突: ${activeSubplots[0].description.slice(0, 80)}`;
  }

  // Character-driven default
  const antagonist = characters.find(c => c.role === 'antagonist');
  const protagonist = characters.find(c => c.role === 'protagonist');
  if (antagonist && protagonist) {
    return `【${protagonist.name}】vs【${antagonist.name}】— ${antagonist.goal || '对抗'}`;
  }
  if (protagonist) {
    return `【${protagonist.name}】的考验 — ${protagonist.goal || '追求目标'}`;
  }

  return '核心冲突待确定';
}

function inferEndingResidue(ctx: CtxShape, chapterIndex: number, activeArcs: { title: string; summary: string; phase: number; chapterCount: number }[]): string {
  // Foreshadowing near payoff — high importance creates cliffhanger
  const activeForeshadowing = (ctx.activeForeshadowing || []).filter(f => f.status === 'active' || f.status === 'planted');
  const highValue = activeForeshadowing.filter(f => f.importance >= 7);
  if (highValue.length > 0) {
    return `伏笔逼近: ${highValue[0].description.slice(0, 60)}...`;
  }

  // Arc boundary — create transition hook
  if (activeArcs.length > 0) {
    const arc = activeArcs[0];
    if (chapterIndex >= arc.phase * (arc.chapterCount / 3)) {
      return `【${arc.title}】转折点 — 下一章将揭开${arc.summary.slice(0, 40)}`;
    }
    return `【${arc.title}】持续推进 — ${arc.summary.slice(0, 40)}`;
  }

  // Subplot or author's memo
  if ((ctx.subplots || []).length > 0) {
    return `支线悬念: ${ctx.subplots![0].name} 伺机而动`;
  }
  if (ctx.contextMemo) {
    const lines = ctx.contextMemo.split('\n').filter(l => l.trim()).slice(-1);
    if (lines.length > 0) return lines[0].slice(0, 60);
  }

  return '制造下一章的牵引力';
}

export function generateControlCard(
  chapterIndex: number,
  title: string,
  context: unknown,
  state: DynamicState,
): ChapterControlCard {
  const ctx = (context || {}) as CtxShape;
  const characters = (ctx.characters || []).map(c => ({
    name: c.name,
    role: c.role,
    goal: c.goal,
    arc: c.arc,
    voice: c.voice,
    background: c.background || '',
    relationships: c.relationships || [],
  }));

  const linesToAdvance = Object.entries(state.plotlineProgress)
    .filter(([_, p]) => p.status === 'active')
    .map(([name]) => name);

  const debtsToReturn = state.emotionalDebts.slice(0, 3);

  const mission = linesToAdvance.length > 0
    ? `推进 ${linesToAdvance.join('、')}，解决当前核心冲突`
    : '推动情节发展';

  // Build enriched character state changes with relationship info
  const characterStateChanges: CharacterStateChange[] = [];
  for (const ch of characters) {
    const existing = state.characterStates[ch.name];
    const status = existing?.status || 'active';
    const emotionalState = inferEmotionalState(ch.role, ch.arc, status);
    const development = inferDevelopment(ch.arc, existing?.status);

    const change: CharacterStateChange = {
      characterId: ch.name,
      status,
      emotionalState,
      development,
    };

    // Include relationship changes if relationships exist and target is also in this project
    if (ch.relationships.length > 0) {
      change.relationshipChanges = ch.relationships.map(r => ({
        targetName: r.targetName,
        delta: r.type === 'rival' || r.type === 'enemy' ? -5 : r.type === 'ally' || r.type === 'friend' ? 5 : 0,
        description: r.description,
      }));
    }

    characterStateChanges.push(change);
  }

  const activeArcs = (ctx.plotArcs || []).filter(a => a.status === 'active');
  const conflict = inferConflict(ctx, chapterIndex, characters);
  const endingResidue = inferEndingResidue(ctx, chapterIndex, activeArcs);

  return {
    chapterIndex,
    title,
    mission,
    linesToAdvance,
    debtsToReturn,
    conflict,
    endingResidue,
    characterStateChanges,
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
