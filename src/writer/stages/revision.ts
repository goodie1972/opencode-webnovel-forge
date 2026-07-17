"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';

export const runRevision: StageRunner = async (input) => {
  const prompt = buildRevisionPrompt(input);
  const response = await callAgent({
    agentName: 'revision_editor',
    userMessage: prompt,
    masterStyle: input.masterStyle,
  });
  return {
    output: response.content,
    agentUsed: 'revision_editor',
    tokensUsed: response.tokensUsed || 0,
    stageName: 'revision',
  };
};

function buildRevisionPrompt(input: StageInput): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';
  const recentChapters = input.context.recentChapters?.map(ch => `\n- Chapter ${ch.index}: ${ch.title}`).join('') || '';

  return `Revise and edit the chapter draft to improve quality, flow, pacing, and fix issues. This is the human-like editing pass.

${styleIntro}${instructions}${prevContext}Recent chapters: ${recentChapters}

Focus on:
- Improving narrative flow and readability
- Tightening pacing and removing unnecessary sections
- Enhancing dialogue and character voice
- Fixing plot holes and inconsistencies
- Improving grammar, punctuation, and word choice
- Adding necessary details and description

Provide thoughtful edits that elevate the writing while maintaining the author's voice. Be constructive and precise in your suggestions.`;
}
