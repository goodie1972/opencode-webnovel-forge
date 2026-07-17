export interface QualityReport {
  overall: number;
  dimensions: QualityDimension[];
  criticalIssues: string[];
  suggestions: string[];
  passed: boolean;
}

export interface QualityDimension {
  name: string;
  score: number;
  issues: string[];
  details?: string;
}

export interface ReviewOptions {
  minLength?: number;
  maxLength?: number;
  requireDialogue?: boolean;
  checkClichés?: boolean;
  checkRepeatWords?: boolean;
}

export const DEFAULT_REVIEW_OPTIONS: ReviewOptions = {
  minLength: 500,
  maxLength: 10000,
  requireDialogue: false,
  checkClichés: true,
  checkRepeatWords: true,
};

function detectDialogue(text: string): number {
  const dialoguePatterns = [
    /"([^"]*)"/g,
    /'([^']*)'/g,
    /「([^」]*)」/g,
  ];
  
  let dialogueChars = 0;
  let totalChars = 0;
  
  for (const pattern of dialoguePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        dialogueChars += match.length;
      }
    }
  }
  
  totalChars = text.length;
  return totalChars > 0 ? Math.round((dialogueChars / totalChars) * 100) : 0;
}

function estimateParagraphStructure(text: string): { score: number; issues: string[]; details: string } {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  let score = 100;
  const issues: string[] = [];
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const sentences = paragraph.match(/[^.!?]+[.!?]/g) || [];
    const sentenceCount = sentences.length;
    
    if (paragraph.length === 0) {
      continue;
    }
    
    if (paragraph.length > 500) {
      issues.push(`Paragraph ${i + 1} too long (${paragraph.length} chars)`);
      score -= 10;
    }
    
    if (paragraph.length < 50 && sentenceCount > 3) {
      issues.push(`Paragraph ${i + 1} has too many sentences for its length (${sentenceCount} sentences)`);
      score -= 5;
    }
    
    if (sentenceCount === 1 && paragraph.length > 200) {
      issues.push(`Paragraph ${i + 1} is a wall of text (${paragraph.length} chars)`);
      score -= 15;
    }
  }
  
  if (paragraphs.length === 0) {
    issues.push("No paragraphs found");
    score = 0;
  }
  
  return { score: Math.max(0, score), issues, details: `${paragraphs.length} paragraphs` };
}

function checkClichés(text: string, patterns: string[]): { score: number; issues: string[]; details: string } {
  const found = patterns.filter(pattern => text.includes(pattern));
  const issueCount = found.length;
  const score = Math.max(0, 100 - (issueCount * 5));
  const issues = found.map(pattern => `Found cliché: ${pattern}`);
  return { score, issues, details: `${found.length} clichés found` };
}

function findRepeatWords(text: string, minProximity?: number): { score: number; issues: string[]; details: string } {
  const words = text.match(/\b\w+\b/g) || [];
  const wordCounts: Record<string, number> = {};
  
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    wordCounts[lowerWord] = (wordCounts[lowerWord] || 0) + 1;
  }
  
  const excessiveWords = Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .slice(0, 5);
  
  const score = excessiveWords.length === 0 ? 100 : Math.max(0, 100 - (excessiveWords.length * 20));
  const issues = excessiveWords.map(([word, count]) => `Word '${word}' appears ${count} times`);
  return { score, issues, details: `${excessiveWords.length} excessive words` };
}

function checkContentLength(text: string, min?: number, max?: number): { score: number; issues: string[]; details: string } {
  const length = text.length;
  const minThreshold = min ?? 500;
  const maxThreshold = max ?? 10000;
  
  let score = 100;
  const issues: string[] = [];
  
  if (length < minThreshold) {
    const deficit = Math.ceil(minThreshold - length);
    const deficitPercent = Math.min(100, Math.round((deficit / minThreshold) * 100));
    issues.push(`Content too short (${length} chars, target ${deficit} chars needed)`);
    score -= deficitPercent;
  }
  
  if (length > maxThreshold) {
    const excess = Math.ceil(length - maxThreshold);
    const excessPercent = Math.min(100, Math.round((excess / maxThreshold) * 100));
    issues.push(`Content too long (${length} chars, limit ${excess} chars)`);
    score -= excessPercent;
  }
  
  const idealScore = Math.max(0, Math.min(100, 100 - Math.abs(length - 5500) / 55));
  const finalScore = Math.round(((score + idealScore) / 2));
  
  return { score: finalScore, issues, details: `${length} characters` };
}

export async function reviewContentAsync(content: string, options: ReviewOptions = {}): Promise<QualityReport> {
  const opts = { ...DEFAULT_REVIEW_OPTIONS, ...options };
  return reviewContent(content, opts);
}

export function reviewContent(content: string, options: ReviewOptions = {}): QualityReport {
  const opts = { ...DEFAULT_REVIEW_OPTIONS, ...options };
  
  const dimensions: QualityDimension[] = [];
  const criticalIssues: string[] = [];
  const suggestions: string[] = [];
  
  const lengthDim = checkContentLength(content, opts.minLength, opts.maxLength);
  dimensions.push({
    name: 'length',
    score: lengthDim.score,
    issues: lengthDim.issues,
    details: lengthDim.details,
  });
  
  if (lengthDim.score < 40) {
    criticalIssues.push(`Length dimension too low (score: ${lengthDim.score})`);
    suggestions.push('Ensure content meets minimum and maximum length requirements');
  }
  
  const dialogueRatio = detectDialogue(content);
  dimensions.push({
    name: 'dialogueRatio',
    score: dialogueRatio,
    issues: [],
    details: `${dialogueRatio}% dialogue`,
  });
  
  if (!opts.requireDialogue && dialogueRatio < 15) {
    if (dimensions[1] && dimensions[1].issues) {
      dimensions[1].issues.push('Dialogue ratio below recommended 15-40%');
    }
    suggestions.push('Add more dialogue to improve flow');
  }
  
  const paragraphDim = estimateParagraphStructure(content);
  dimensions.push({
    name: 'paragraphStructure',
    score: paragraphDim.score,
    issues: paragraphDim.issues,
    details: paragraphDim.details,
  });
  
  if (paragraphDim.score < 40) {
    criticalIssues.push(`Paragraph structure too poor (score: ${paragraphDim.score})`);
    suggestions.push('Improve paragraph structure with better line breaks');
  }
  
  const chineseClichésPatterns = [
    '眼中闪过一丝',
    '嘴角勾起一抹',
    '不由得倒吸一口凉气',
    '心头一热',
    '眼中闪过一丝恼怒',
    '嘴角勾起一抹笑意',
    '不由得怒火中烧',
    '心中一暖',
    '眼中闪过一丝悔意',
    '嘴角泛起一丝弧度',
  ];
  
  const englishClichésPatterns = [
    'heart skipped a beat',
    'tightened their grip',
    'felt a sudden chill',
    'fire raced through their veins',
    'warmth spread through their chest',
    'a sudden realization dawned',
    'suddenly felt compelled',
    'became fiercely determined',
    'resentment bubbling up',
    'smile faded from their face',
  ];
  
  const clichéCheck = checkClichés(content, opts.checkClichés ? [...chineseClichésPatterns, ...englishClichésPatterns] : []);
  dimensions.push({
    name: 'clichés',
    score: clichéCheck.score,
    issues: clichéCheck.issues,
    details: clichéCheck.details,
  });
  
  if (clichéCheck.score < 40) {
    criticalIssues.push(`Excessive cliché usage (score: ${clichéCheck.score})`);
    suggestions.push('Reduce cliché usage for more original writing');
  }
  
  if (opts.checkRepeatWords) {
    const repeatWordsDim = findRepeatWords(content);
    dimensions.push({
      name: 'repeatWords',
      score: repeatWordsDim.score,
      issues: repeatWordsDim.issues,
      details: repeatWordsDim.details,
    });
    
    if (repeatWordsDim.score < 40) {
      criticalIssues.push(`Excessive word repetition (score: ${repeatWordsDim.score})`);
      suggestions.push('Vary vocabulary to eliminate word repetition');
    }
  }
  
  const overall = dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length;
  const passed = criticalIssues.length === 0 && overall >= 60;
  
  return {
    overall: Math.round(overall),
    dimensions,
    criticalIssues,
    suggestions,
    passed,
  };
}
