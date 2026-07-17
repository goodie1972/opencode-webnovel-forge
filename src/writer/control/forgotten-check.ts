import type { DynamicState, ForgottenCheckResult } from './types';

export function forgottenCheck(state: DynamicState, currentChapter: number): ForgottenCheckResult {
  const overdueCharacters: string[] = [];
  const coldPlotlines: string[] = [];
  const foreshadowingExpiring: string[] = [];

  for (const [name, cs] of Object.entries(state.characterStates)) {
    const chaptersSince = currentChapter - cs.lastAppearance;
    if (chaptersSince >= 3) overdueCharacters.push(name);
  }

  for (const [name, ps] of Object.entries(state.plotlineProgress)) {
    const chaptersSince = currentChapter - ps.lastAdvancement;
    if (chaptersSince >= 5) coldPlotlines.push(name);
  }

  for (const [name, fs] of Object.entries(state.foreshadowingStatus)) {
    if (fs.status === 'paid_off' || fs.status === 'abandoned') continue;
    const windowLength = fs.expectedPayoffWindow[1] - fs.expectedPayoffWindow[0];
    const elapsed = currentChapter - fs.plantedAt;
    if (windowLength > 0 && elapsed > windowLength * 1.5) {
      foreshadowingExpiring.push(name);
    }
  }

  const total = overdueCharacters.length + coldPlotlines.length + foreshadowingExpiring.length;
  const overallScore = Math.max(0, 100 - total * 15);

  return {
    overdueCharacters,
    coldPlotlines,
    unreturnedDebts: state.emotionalDebts,
    foreshadowingExpiring,
    overallScore,
  };
}
