export interface ChapterControlCard {
  chapterIndex: number;
  title: string;
  mission: string;
  linesToAdvance: string[];
  debtsToReturn: string[];
  conflict: string;
  endingResidue: string;
  characterStateChanges: string[];
}

export interface CharacterState {
  lastAppearance: number;
  status: string;
  relationshipChanges: string[];
}

export interface PlotlineState {
  lastAdvancement: number;
  status: string;
  nextExpectedBeat: string;
}

export interface ForeshadowState {
  status: 'planted' | 'active' | 'paid_off' | 'abandoned';
  plantedAt: number;
  expectedPayoffWindow: [number, number];
}

export interface DynamicState {
  lastChapterIndex: number;
  characterStates: Record<string, CharacterState>;
  plotlineProgress: Record<string, PlotlineState>;
  foreshadowingStatus: Record<string, ForeshadowState>;
  emotionalDebts: string[];
  pendingConfirmations: string[];
  chaptersWritten: number;
}

export interface ForgottenCheckResult {
  overdueCharacters: string[];
  coldPlotlines: string[];
  unreturnedDebts: string[];
  foreshadowingExpiring: string[];
  overallScore: number;
}