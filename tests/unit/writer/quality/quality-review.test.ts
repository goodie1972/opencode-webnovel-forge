import { test, expect } from 'bun:test';
import { reviewContent, reviewContentAsync } from '../../../../src/writer/quality/quality-review';

const GOOD_CONTENT = Array(22).fill(
  'This is a well-written paragraph with proper pacing. "Hello," she said warmly. The protagonist responded, and the conversation flowed naturally. Each sentence added depth to the narrative.'
).join('\n\n');

const SHORT_CONTENT = 'Short.';

const DIALOGUE_RICH_CONTENT = [
  '',
  '"Hello," she said.',
  '',
  '"Welcome home," he replied warmly.',
  '',
  '"Thank you for coming," she answered happily.',
  '',
  'A brief narrative moment.',
  '',
  '"Let\'s start," he suggested.',
  '',
  'More narrative. "Yes," she agreed.',
].join('\n');

const CLICHES_CONTENT = [
  'Her heart skipped a beat when she saw him.',
  'He tightened their grip on the weapon.',
  'She felt a sudden chill run down her spine.',
  'A sudden realization dawned on him.',
  'He became fiercely determined to win.',
  'She felt a warmth spread through her chest.',
].join('\n');

const REPEAT_WORDS_CONTENT = 'zzz zzz zzz xxx xxx yyy yyy zzz zzz zzz xxx xxx';

test('long content scores high on length dimension', () => {
  const report = reviewContent(GOOD_CONTENT);
  const d = report.dimensions.find(d => d.name === 'length')!;
  expect(d.score).toBeGreaterThanOrEqual(60);
});

test('short content flags length issue', () => {
  const report = reviewContent(SHORT_CONTENT);
  const d = report.dimensions.find(d => d.name === 'length')!;
  expect(d.score).toBeLessThan(40);
});

test('dialogue detection', () => {
  const report = reviewContent(DIALOGUE_RICH_CONTENT);
  const d = report.dimensions.find(d => d.name === 'dialogueRatio')!;
  expect(d.score).toBeGreaterThanOrEqual(10);
});

test('cliche detection', () => {
  const report = reviewContent(CLICHES_CONTENT);
  const d = report.dimensions.find(d => d.name === 'clichés')!;
  expect(d.issues.length).toBeGreaterThan(0);
});

test('repeat word detection', () => {
  const report = reviewContent(REPEAT_WORDS_CONTENT, { checkRepeatWords: true });
  const d = report.dimensions.find(d => d.name === 'repeatWords')!;
  expect(d.score).toBeLessThanOrEqual(80);
});

test('overall scoring', () => {
  const report = reviewContent(GOOD_CONTENT);
  expect(report.overall).toBeGreaterThanOrEqual(50);
});

test('passed=false when critical issues exist', () => {
  const report = reviewContent(CLICHES_CONTENT);
  expect(report.passed).toBe(false);
});

test('async wrapper resolves', async () => {
  const report = await reviewContentAsync(GOOD_CONTENT);
  expect(report.overall).toBeGreaterThanOrEqual(50);
});
