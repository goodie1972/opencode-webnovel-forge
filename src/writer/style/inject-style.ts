import fs from 'fs';
import path from 'path';

export interface MasterStyleData {
  name?: string;
  displayName?: string;
  styleGuide?: string;
  characteristics?: string[];
  strengths?: string[];
  weaknesses?: string[];
}

const MASTERS_DIR = path.join(process.cwd(), 'prompts', 'masters');

let _cachedMasters: MasterStyleData[] | null = null;

function loadAllMasters(): MasterStyleData[] {
  if (_cachedMasters) return _cachedMasters;
  _cachedMasters = [];
  if (!fs.existsSync(MASTERS_DIR)) return _cachedMasters;
  const files = fs.readdirSync(MASTERS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(MASTERS_DIR, file), 'utf-8'));
      _cachedMasters.push(raw);
    } catch { /* skip */ }
  }
  return _cachedMasters;
}

export function clearMasterCache(): void {
  _cachedMasters = null;
}

export function findMaster(styleName: string): MasterStyleData | undefined {
  return loadAllMasters().find(
    m => m.name === styleName || m.displayName === styleName,
  );
}

export function injectStyle(basePrompt: string, styleName: string): string {
  const master = findMaster(styleName);
  if (!master) return basePrompt;

  let section = '\n\n## 风格指令\n';
  if (master.styleGuide) section += `【风格指南】${master.styleGuide}\n`;
  if (master.characteristics?.length) section += `【风格特征】${master.characteristics.join('；')}\n`;
  if (master.strengths?.length) section += `【优势】${master.strengths.join('；')}\n`;
  if (master.weaknesses?.length) section += `【注意事项】${master.weaknesses.join('；')}\n`;

  return basePrompt + section;
}
