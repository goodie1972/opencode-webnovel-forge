"use strict";

import { type NovelMeta, type CharacterRole, type ArcStatus, type ForeshadowingCategory, type ForeshadowingStatus } from '../../novel/types';
import { type ProjectData } from '../../novel/project';
import { WorldService } from '../../novel/world';
import { CharacterService } from '../../novel/character';
import { PlotService } from '../../novel/plot';
import { ForeshadowingManager } from '../../novel/foreshadowing';
import { ShuangPointTracker } from '../../novel/shuang';
import { NovelProjectManager } from '../../novel/project';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AgentContext {
  projectMeta: NovelMeta;
  totalChapters: number;
  totalWords: number;
  recentChapters: { title: string; index: number; content: string }[];
  worldSummary: { 
    factions: number; 
    locations: number; 
    events: number; 
    factionNames: string[]; 
    locationNames: string[];
    factionDetails: { name: string; description: string; goals: string[]; power: number; memberCount: number }[];
    locationDetails: { name: string; description: string; type: string }[];
  };
  characters: { 
    name: string; 
    role: string; 
    traits: string[]; 
    goal: string;
    background: string;
    arc: string;
    voice: string;
    relationships: { targetName: string; type: string; description: string }[];
  }[];
  plotArcs: { title: string; summary: string; status: string; phase: number; chapterCount: number }[];
  activeForeshadowing: { 
    description: string; 
    importance: number; 
    category: string;
    status: string;
    plantAt: { chapterId: string; detail: string };
    payoffAt?: { chapterId: string; detail: string };
  }[];
  subplots: { name: string; description: string; status: string; relatedArc: string }[];
  shuangStats: { total: number; byType: Record<string, number>; avgIntensity: number };
  contextMemo: string;
}

export async function buildAgentContext(
  pm: NovelProjectManager,
  dirName: string,
  options?: { recentChapterCount?: number; maxContextLength?: number },
): Promise<AgentContext> {
  try {
    const project = pm.load(dirName);
    const recentChapterCount = options?.recentChapterCount ?? 5;
    const maxContextLength = options?.maxContextLength ?? 8000;

    const recentChapters = await getRecentChapters(pm, dirName, recentChapterCount);

    const worldService = new WorldService(pm, dirName);
    const worldSummary = await getWorldSummary(worldService);

    const characterService = new CharacterService(pm, dirName);
    const characters = await getCharacters(characterService);

    const plotService = new PlotService(pm, dirName);
    const { arcs, subplots } = await getPlotData(plotService);

    const foreshadowingManager = new ForeshadowingManager(pm, dirName);
    const activeForeshadowing = await getActiveForeshadowing(foreshadowingManager);

    const shuangTracker = new ShuangPointTracker(pm, dirName);
    const shuangStats = shuangTracker.getStats();

    const contextMemo = readContextMemo(pm, dirName);

    return {
      projectMeta: project.meta,
      totalChapters: project.chapters.length,
      totalWords: project.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
      recentChapters,
      worldSummary,
      characters,
      plotArcs: arcs,
      activeForeshadowing,
      subplots,
      shuangStats,
      contextMemo: truncateContext(contextMemo, maxContextLength, recentChapters),
    };
  } catch (error) {
    throw new Error(`Failed to build agent context for project '${dirName}': ${error}`);
  }
}

async function getRecentChapters(
  pm: NovelProjectManager,
  dirName: string,
  count: number,
): Promise<{ title: string; index: number; content: string }[]> {
  try {
    const project = pm.load(dirName);
    const chapters = project.chapters;
    if (!chapters || chapters.length === 0) return [];

    const recentChapters = chapters.slice(-count);
    const result: { title: string; index: number; content: string }[] = [];

    for (const chapter of recentChapters) {
      const content = pm.readChapterContent(dirName, chapter.id);
      result.push({
        title: chapter.title,
        index: chapter.index,
        content,
      });
    }

    return result;
  } catch {
    return [];
  }
}

function readContextMemo(pm: NovelProjectManager, dirName: string): string {
  try {
    const contextPath = path.join(pm.projectsDir, dirName, 'context.md');
    if (fs.existsSync(contextPath)) {
      return fs.readFileSync(contextPath, 'utf-8');
    }
  } catch {
  }

  return '';
}

function truncateContext(
  context: string,
  maxLength: number,
  recentChapters: { title: string; index: number; content: string }[],
): string {
  let result = context;

  if (result.length > maxLength) {
    result = result.substring(0, Math.max(0, maxLength - 100));
  }

  if (result.length + recentChapters[0]?.content.length > maxLength) {
    result = result.substring(0, Math.max(0, maxLength - recentChapters[0].content.length));
  }

  return result;
}

async function getWorldSummary(worldService: WorldService) {
  const factions = worldService.getFactions();
  const locations = worldService.getLocations();
  const events = worldService.getEvents();

  return {
    factions: factions.length,
    locations: locations.length,
    events: events.length,
    factionNames: factions.map(f => f.name),
    locationNames: locations.map(l => l.name),
    factionDetails: factions.map(f => ({
      name: f.name,
      description: f.description,
      goals: f.goals,
      power: f.power,
      memberCount: f.members.length,
    })),
    locationDetails: locations.map(l => ({
      name: l.name,
      description: l.description,
      type: l.type,
    })),
  };
}

async function getCharacters(characterService: CharacterService) {
  const characters = characterService.getCharacters();
  const nameById = Object.fromEntries(characters.map(c => [c.id, c.name]));
  return characters.map(c => ({
    name: c.name,
    role: c.role,
    traits: c.traits,
    goal: c.goal,
    background: c.background,
    arc: c.arc,
    voice: c.voice,
    relationships: c.relationships.map(r => ({
      targetName: nameById[r.targetId] ?? r.targetId,
      type: r.type,
      description: r.description,
    })),
  }));
}

async function getPlotData(plotService: PlotService) {
  return {
    arcs: plotService.getArcs().map(a => ({
      title: a.title,
      summary: a.summary,
      status: a.status as string,
      phase: a.phase,
      chapterCount: a.chapters.length,
    })),
    subplots: plotService.getSubplots().map(s => ({
      name: s.name,
      description: s.description,
      status: s.status as string,
      relatedArc: s.relatedArc,
    })),
  };
}

async function getActiveForeshadowing(foreshadowingManager: ForeshadowingManager) {
  const activeEntries = foreshadowingManager.getActiveEntries();
  
  // Sort by importance descending, top 20, and extract the required fields
  return activeEntries
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 20)
    .map(entry => ({
      description: entry.description,
      importance: entry.importance,
      category: entry.category as string,
      status: entry.status,
      plantAt: entry.plantAt,
      payoffAt: entry.payoffAt,
    }));
}
