export interface ChapterControlCard {
  chapterIndex: number;
  title: string;
  mission: string;
  linesToAdvance: string[];
  debtsToReturn: string[];
  conflict: string;
  endingResidue: string;
  characterStateChanges: { characterId: string; status: string }[];
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
