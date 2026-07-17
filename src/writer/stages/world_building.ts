"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';

export const runWorldBuilding: StageRunner = async (input) => {
  const prompt = buildWorldBuildingPrompt(input);
  const response = await callAgent({
    agentName: 'world_builder',
    userMessage: prompt,
    masterStyle: input.masterStyle,
  });
  return {
    output: response.content,
    agentUsed: 'world_builder',
    tokensUsed: response.tokensUsed || 0,
    stageName: 'world_building',
  };
};

function buildWorldBuildingPrompt(input: StageInput): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';

  return `Create a comprehensive world-building document for the novel "${meta.title}". 

Genre: ${meta.genre}
Tags: ${meta.tags.join(', ')}
Target words: ${meta.targetWords}

${styleIntro}${instructions}${prevContext}

Please include the following elements:
- Factions (political/evil groups, their motivations and power structures)
- Locations (major settings with descriptions)
- History (timeline of major events)
- Power systems (magic, technology, supernatural rules)
- Detailed lore and cultural background

Format in markdown with clear headings and subsections. Make it immersive and consistent with the genre. Ensure all world elements are interconnected.`;
}
