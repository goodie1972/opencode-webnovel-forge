export interface CharacterStateChange {
  characterId: string;
  status: string;
  emotionalState?: string;
  relationshipChanges?: { targetName: string; delta: number; description: string }[];
  development?: string;
}

export interface ChapterControlCard {
  chapterIndex: number;
  title: string;
  mission: string;
  linesToAdvance: string[];
  debtsToReturn: string[];
  conflict: string;
  endingResidue: string;
  characterStateChanges: CharacterStateChange[];
}

export interface DynamicState {
  lastChapterIndex: number;
  characterStates: Record<string, { lastAppearance: number; status: string; relationshipChanges: any[] }>;
  plotlineProgress: Record<string, { lastAdvancement: number; status: string; nextExpectedBeat?: string }>;
  foreshadowingStatus: Record<string, { status: string; hints: string[]; plantedAt: number; expectedPayoffWindow: [number, number] }>;
  emotionalDebts: string[];
  pendingConfirmations: any[];
  chaptersWritten: number;
}

export interface ForgottenCheckResult {
  overdueCharacters: string[];
  coldPlotlines: string[];
  unreturnedDebts: string[];
  foreshadowingExpiring: string[];
  overallScore: number;
}
