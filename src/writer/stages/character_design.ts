"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';

export const runCharacterDesign: StageRunner = async (input) => {
  const prompt = buildCharacterDesignPrompt(input);
  const response = await callAgent({
    agentName: 'character_designer',
    userMessage: prompt,
    masterStyle: input.masterStyle,
  });
  return {
    output: response.content,
    agentUsed: 'character_designer',
    tokensUsed: response.tokensUsed || 0,
    stageName: 'character_design',
  };
};

function buildCharacterDesignPrompt(input: StageInput): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';
  const characters = input.context.characters?.map(c => `\n- ${c.name}: ${c.role}, ${c.traits.join(', ')}. Goal: ${c.goal}`).join('') || '';

  return `Design 3-5 main characters for the novel "${meta.title}" (genre: ${meta.genre}).

${styleIntro}${instructions}${prevContext}Context from world building: factions: ${context.worldSummary.factionNames.join(', ')}; locations: ${context.worldSummary.locationNames.join(', ')}.

Existing characters: ${characters}

Please create:
- Protagonist (main character with clear goals and motivations)
- Antagonist (if applicable, with their own motivations)
- 1-3 supporting characters (important to plot)

For each character, include:
- Name and role
- Personality traits and background
- Primary motivation and goal
- Character arc (development through story)
- Distinctive voice/speech patterns
- Key relationships with other characters

Format as markdown character profiles with clear sections for each character. Make them consistent with the genre and world setting.`;
}
