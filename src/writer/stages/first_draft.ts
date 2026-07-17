"use strict";

import { callAgent } from '../agent-runtime';
import type { StageInput, StageResult, StageRunner } from './types';
import { reviewContent, saveQualityReport } from '../quality/quality-review';
import { generateControlCard, saveControlCard } from '../control/control-card';

const WRITER_POOL = ['writer_a', 'writer_b', 'writer_c'];

function injectControlCard(prompt: string, card: any): string {
  return [
    prompt,
    `\n【本章控制卡】`,
    `任务: ${card.mission}`, // already in Chinese
    `推进情节: ${card.linesToAdvance.join(', ')}`,
    `偿清债务: ${card.debtsToReturn.join(', ')}`,
    `核心冲突: ${card.conflict}`,
    `结尾余波: ${card.endingResidue}`,
  ].join('\n');
}

export const runFirstDraft: StageRunner = async (input) => {
  const writtenCount = input.context.recentChapters?.length || 0;
  const chaptersToWrite = Math.max(0, input.context.totalChapters - writtenCount);

  if (chaptersToWrite <= 1) {
    let prompt = buildChapterPrompt(input, writtenCount + 1);
    
    // Inject control card into prompt if present
    if (input.controlCard) {
      prompt = injectControlCard(prompt, input.controlCard);
    }
    
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
  }

  const parallelCount = Math.min(3, chaptersToWrite);

  // First batch: parallel writers from pool
  const parallelResults = await Promise.all(
    Array.from({ length: parallelCount }, (_, i) => {
      let prompt = buildChapterPrompt(input, writtenCount + i + 1);
      // Inject control card into prompt if present (using the same card for all parallel writers)
      if (input.controlCard) {
        prompt = injectControlCard(prompt, input.controlCard);
      }
      return callAgent({
        agentName: WRITER_POOL[i],
        userMessage: prompt,
        masterStyle: input.masterStyle,
      });
    })
  );

  // Remaining: single writer sequential
  const remainingResults: { content: string; tokensUsed?: number }[] = [];
  for (let i = parallelCount; i < chaptersToWrite; i++) {
    let prompt = buildChapterPrompt(input, writtenCount + i + 1);
    if (input.controlCard) {
      prompt = injectControlCard(prompt, input.controlCard);
    }
    const resp = await callAgent({
      agentName: 'writer_a',
      userMessage: prompt,
      masterStyle: input.masterStyle,
    });
    remainingResults.push(resp);
  }

  const allResults = [...parallelResults, ...remainingResults];
  const agentsUsed = allResults.map((_, i) =>
    i < parallelCount ? WRITER_POOL[i] : 'writer_a'
  );

  const combinedOutput = allResults.map((r, i) =>
    `# Chapter ${writtenCount + i + 1}\n\n${r.content}\n`
  ).join('\n---\n');

  return {
    output: combinedOutput,
    agentUsed: [...new Set(agentsUsed)].join(','),
    tokensUsed: allResults.reduce((s, r) => s + (r.tokensUsed || 0), 0),
    stageName: 'first_draft',
  };
};

function buildChapterPrompt(input: StageInput, chapterNum: number): string {
  const { context, masterStyle, userInstructions, previousOutput } = input;
  const meta = context.projectMeta;
  const styleIntro = masterStyle ? `Use writing style: ${masterStyle}.\n` : '';
  const instructions = userInstructions ? `User instructions: ${userInstructions}\n` : '';
  const prevContext = previousOutput ? `Previous output: ${previousOutput}\n` : '';
  const recentChapters = context.recentChapters?.map(ch => `\n- Chapter ${ch.index}: ${ch.title}`).join('') || '';
  const characters = context.characters?.map(c => `\n- ${c.name} (${c.role}): ${c.goal}`).join('') || '';
  const plotArcs = context.plotArcs?.map(a => `\n- ${a.title}: ${a.summary}`).join('') || '';
  const nextOutline = context.plotArcs?.[chapterNum - 1]?.summary || '';

  return `Write Chapter ${chapterNum} for "${meta.title}".

${styleIntro}${instructions}${prevContext}Previous chapters: ${recentChapters}
Characters: ${characters}
Plot arcs: ${plotArcs}
${nextOutline ? `\nThis chapter summary: ${nextOutline}` : ''}

Focus on:
- Narrative flow and pacing
- Character dialogue and development
- Scene descriptions and atmosphere
- Plot progression according to the arc summary
${chapterNum <= 3 ? '- This is one of the opening chapters — establish tone and hook the reader' : '- Maintain consistency with established style and voice'}
- Engaging, genre-appropriate content with proper structure`;
}
