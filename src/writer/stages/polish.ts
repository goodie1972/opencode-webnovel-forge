"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';

export const runPolish: StageRunner = async (input) => {
  const prompt = buildPolishPrompt(input);
  const response = await callAgent({
    agentName: 'polisher',
    userMessage: prompt,
    masterStyle: input.masterStyle,
  });
  return {
    output: response.content,
    agentUsed: 'polisher',
    tokensUsed: response.tokensUsed || 0,
    stageName: 'polish',
  };
};

function buildPolishPrompt(input: StageInput): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';

  return `Perform final polish pass on the chapter text with light touch focus.

${styleIntro}${instructions}${prevContext}Novel: "${meta.title}" (genre: ${meta.genre})

Final polish tasks:
- Check grammar, punctuation, and spelling
- Refine word choice and rhythm
- Ensure consistency in character voice and style
- Smooth transitions between sentences and paragraphs
- Maintain pacing and readability
- Fix any remaining typos or awkward phrasing

Provide cleaned, polished text ready for publication.`;
}
