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

export function updateAfterChapter(state: DynamicState, card: ChapterControlCard): DynamicState {
  const updated = { ...state };
  updated.lastChapterIndex = card.chapterIndex;
  updated.chaptersWritten += 1;

  // Update character states based on control card changes
  for (const change of card.characterStateChanges || []) {
    const match = change.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [_, charName, status] = match;
      if (!updated.characterStates[charName]) {
        updated.characterStates[charName] = {
          lastAppearance: card.chapterIndex,
          status: 'active',
          relationshipChanges: [],
        };
      }
      updated.characterStates[charName].lastAppearance = card.chapterIndex;
      updated.characterStates[charName].status = status;
    }
  }

  // Track emotional debts
  for (const debt of card.debtsToReturn) {
    if (!updated.emotionalDebts.includes(debt)) {
      updated.emotionalDebts.push(debt);
    }
  }

  return updated;
}
