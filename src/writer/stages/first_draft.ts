"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';

export const runFirstDraft: StageRunner = async (input) => {
  const prompt = buildFirstDraftPrompt(input);
  const response = await callAgent({
    agentName: 'first_draft_writer',
    userMessage: prompt,
    masterStyle: input.masterStyle,
  });
  return {
    output: response.content,
    agentUsed: 'first_draft_writer',
    tokensUsed: response.tokensUsed || 0,
    stageName: 'first_draft',
  };
};

function buildFirstDraftPrompt(input: StageInput): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';
  const recentChapters = input.context.recentChapters?.map(ch => `\n- Chapter ${ch.index}: ${ch.title}`).join('') || '';
  const characters = input.context.characters?.map(c => `\n- ${c.name} (${c.role}): ${c.goal}`).join('') || '';

  return `Write the actual chapter content for "${meta.title}" based on the outline.

${styleIntro}${instructions}${prevContext}Recent chapters: ${recentChapters}
Characters: ${characters}

This is the ${input.context.recentChapters?.length || 0 ? 'next chapter' : 'first chapter'} in the novel. Focus on:
- Narrative flow and pacing
- Character dialogue and development
- Scene descriptions and atmosphere
- Plot progression according to outline

Write engaging, genre-appropriate content. Ensure continuity with previous chapters and development consistent with the character profiles. Include all necessary action, dialogue, and internal monologue to maintain reader engagement.`;
}
