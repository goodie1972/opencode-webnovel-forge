import { reviewContent } from './quality-review';
import type { QualityReport, ReviewOptions } from './quality-review';
export { reviewContent };

export interface RevisionConfig {
  maxIterations: number;
  qualityThreshold: number;
  dimensionThreshold: number;
}

export interface RevisionResult {
  content: string;
  iterations: number;
  finalReport: QualityReport;
  iterationReports: QualityReport[];
  converged: boolean;
}

export const DEFAULT_REVISION_CONFIG: RevisionConfig = {
  maxIterations: 3,
  qualityThreshold: 80,
  dimensionThreshold: 60,
};

export async function reviseContent(
  content: string,
  callAgentFn: (prompt: string) => Promise<string>,
  config: Partial<RevisionConfig> = {},
): Promise<RevisionResult> {
  const options: ReviewOptions = {};
  const revisionConfig = { ...DEFAULT_REVISION_CONFIG, ...config };
  
  const iterationReports: QualityReport[] = [];
  let currentContent = content;
  
  for (let iteration = 0; iteration < revisionConfig.maxIterations; iteration++) {
    const report = reviewContent(currentContent, options);
    iterationReports.push(report);
    
    const allDimensionsPass = report.dimensions.every(dim => dim.score >= revisionConfig.dimensionThreshold);
    const qualityReached = report.overall >= revisionConfig.qualityThreshold;
    
    if (allDimensionsPass && qualityReached) {
      const finalReport = report;
      return {
        content: currentContent,
        iterations: iteration + 1,
        finalReport,
        iterationReports,
        converged: true,
      };
    }
    
    if (iteration === revisionConfig.maxIterations - 1) {
      const finalReport = report;
      return {
        content: currentContent,
        iterations: iteration + 1,
        finalReport,
        iterationReports,
        converged: false,
      };
    }
    
    const prompt = generateRevisionPrompt(report, currentContent);
    const revisedContent = await callAgentFn(prompt);
    currentContent = revisedContent;
  }
  
  throw new Error('Revision loop exited unexpectedly');
}

function generateRevisionPrompt(report: QualityReport, content: string): string {
  const issues = report.dimensions.filter(dim => dim.score < 80).map(dim => 
    `- ${dim.name}: ${dim.score}/100 - ${dim.issues.join(', ')}`
  ).join('\n');
  
  const criticals = report.criticalIssues.map(issue => `- ${issue}`).join('\n');
  
  return `Please revise this content based on the following quality assessment:

OVERALL SCORE: ${report.overall}/100
PASSED: ${report.passed ? 'Yes' : 'No'}

DIMENSION ISSUES:
${issues}

CRITICAL ISSUES:
${criticals}

SUGGESTIONS:
${report.suggestions.map(s => `- ${s}`).join('\n')}

Please provide an improved version that addresses these issues.

ORIGINAL CONTENT:
---
${content}
---`;
}
