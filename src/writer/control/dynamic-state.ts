import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ChapterControlCard, DynamicState } from './types';

const DYNAMIC_STATE_FILE = 'dynamic-state.json';

export function createEmptyState(): DynamicState {
  return {
    lastChapterIndex: 0,
    characterStates: {},
    plotlineProgress: {},
    foreshadowingStatus: {},
    emotionalDebts: [],
    pendingConfirmations: [],
    chaptersWritten: 0,
  };
}

export function loadDynamicState(projectsDir: string, projectDir: string): DynamicState | null {
  const filePath = path.join(projectsDir, projectDir, DYNAMIC_STATE_FILE);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveDynamicState(projectsDir: string, projectDir: string, state: DynamicState): void {
  const dir = path.join(projectsDir, projectDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, DYNAMIC_STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function updateAfterChapter(
  state: DynamicState,
  card: ChapterControlCard,
  characterNames?: string[],
): DynamicState {
  const updated = { ...state };
  updated.lastChapterIndex = card.chapterIndex;
  updated.chaptersWritten += 1;

  // Update character states based on control card changes
  for (const change of card.characterStateChanges || []) {
    const charName = change.characterId;
    const status = change.status || 'active';
    
    if (!charName) continue;
    if (!updated.characterStates[charName]) {
      updated.characterStates[charName] = {
        lastAppearance: card.chapterIndex,
        status: 'active',
        relationshipChanges: [],
      };
    }
    const cs = updated.characterStates[charName];
    cs.lastAppearance = card.chapterIndex;
    cs.status = status;

    // Apply relationship changes
    if (change.relationshipChanges) {
      for (const rc of change.relationshipChanges) {
        cs.relationshipChanges.push({
          chapter: card.chapterIndex,
          target: rc.targetName,
          delta: rc.delta,
          description: rc.description,
        });
      }
    }
  }

  // Track emotional debts
  for (const debt of card.debtsToReturn) {
    if (!updated.emotionalDebts.includes(debt)) {
      updated.emotionalDebts.push(debt);
    }
  }

  // Auto-detect character appearances from AgentContext character list
  // Only updates existing characters — new characters require explicit characterStateChanges
  if (characterNames) {
    for (const name of characterNames) {
      if (updated.characterStates[name]) {
        updated.characterStates[name].lastAppearance = card.chapterIndex;
      }
    }
  }

  return updated;
}
