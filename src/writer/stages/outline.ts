"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';

export const runOutline: StageRunner = async (input) => {
  const prompt = buildOutlinePrompt(input);
  const response = await callAgent({
    agentName: 'outliner',
    userMessage: prompt,
    masterStyle: input.masterStyle,
  });
  return {
    output: response.content,
    agentUsed: 'outliner',
    tokensUsed: response.tokensUsed || 0,
    stageName: 'outline',
  };
};

function buildOutlinePrompt(input: StageInput): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';
  const characters = input.context.characters?.map(c => `\n- ${c.name}: ${c.role}, ${c.goal}`).join('') || '';
  const plotArcs = input.context.plotArcs?.map(a => `\n- ${a.title}: ${a.summary}`).join('') || '';

  return `Create a chapter-by-chapter outline for "${meta.title}" (target: ${meta.targetWords} words, genre: ${meta.genre}).

${styleIntro}${instructions}${prevContext}Characters: ${characters}
Plot arcs: ${plotArcs}

Please create a detailed outline including:
- Number of chapters based on target words (estimate 1500-2500 words per chapter)
- Each chapter with title and key scenes
- Chapter tension points and major beats
- Foreshadowing placements for key plot points
- Character development milestones per chapter

Format as markdown with clear chapter headings. Estimate total word count per chapter based on typical genre pacing. Ensure the outline flows logically and maintains consistency with previous world building and character development.`;
}
