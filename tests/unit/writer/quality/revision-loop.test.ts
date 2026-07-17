import { test, expect } from 'bun:test';
import { reviseContent } from '../../../../src/writer/quality/revision-loop';

const GOOD_CONTENT = Array(22).fill(
  'This is a well-written paragraph with proper pacing. "Hello," she said warmly. The protagonist responded, and the conversation flowed naturally. Each sentence added depth to the narrative.'
).join('\n\n');

test('returns immediately when already above threshold', async () => {
  const result = await reviseContent(GOOD_CONTENT, async () => 'should not be called', {
    qualityThreshold: 30, dimensionThreshold: 0, maxIterations: 3,
  });
  expect(result.converged).toBe(true);
  expect(result.iterations).toBe(1);
  expect(result.content).toBe(GOOD_CONTENT);
});

test('single revision with mock improves', async () => {
  const poorContent = 'heart skipped a beat heart skipped a beat heart skipped a beat';
  const result = await reviseContent(
    poorContent,
    async () => GOOD_CONTENT,
    { qualityThreshold: 60, dimensionThreshold: 0, maxIterations: 3 },
  );
  expect(result.iterations).toBeGreaterThan(1);
  expect(result.content).toBe(GOOD_CONTENT);
});

test('respects max iterations limit', async () => {
  const result = await reviseContent(
    'heart skipped a beat heart skipped a beat',
    async () => 'heart skipped a beat heart skipped a beat',
    { qualityThreshold: 99, dimensionThreshold: 0, maxIterations: 2 },
  );
  expect(result.iterations).toBe(2);
  expect(result.converged).toBe(false);
  expect(result.iterationReports.length).toBe(2);
});

test('reports from each iteration are included', async () => {
  const poorContent = 'heart skipped a beat heart skipped a beat heart skipped a beat';
  const result = await reviseContent(
    poorContent,
    async () => GOOD_CONTENT,
    { qualityThreshold: 60, dimensionThreshold: 0, maxIterations: 3 },
  );
  expect(result.iterationReports.length).toBeGreaterThanOrEqual(2);
  expect(result.finalReport.overall).toBeGreaterThanOrEqual(0);
});
