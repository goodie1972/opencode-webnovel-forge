/**
 * 中篇测试 — 项目创建 & 运行脚本
 *
 * 在 OpenCode 会话中运行:
 *   1. bun run scripts/setup-test.ts
 *   2. /novel write --auto 星穹之巅
 *
 * 或直接使用 node:
 *   bun run scripts/setup-test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '..');
const PROJECT_NAME = '星穹之巅';

async function main() {
  console.log(`\n📖 准备测试项目: ${PROJECT_NAME}\n`);

  // 1. Verify config
  const configPath = path.join(WORKSPACE_ROOT, '.opencode', 'opencode-webnovel-forge.yaml');
  if (fs.existsSync(configPath)) {
    console.log(`  ✅ 配置: ${configPath}`);
    const content = fs.readFileSync(configPath, 'utf-8');
    const agentCount = (content.match(/model:/g) || []).length;
    console.log(`  ℹ  已配置 ${agentCount} 个 agent 模型 (plan-c / 全球免费模型)`);
  } else {
    console.log('  ⚠️  未找到配置，请运行 /novel model init plan-c');
  }

  // 2. Show novels directory
  const novelsDir = path.join(WORKSPACE_ROOT, 'novels');
  if (!fs.existsSync(novelsDir)) {
    fs.mkdirSync(novelsDir, { recursive: true });
  }
  const existing = fs.readdirSync(novelsDir);
  console.log(`  📁 novels/ 目录: ${existing.length} 个项目`);

  // 3. Instructions
  console.log(`\n🚀 运行全自动写作管线:\n`);
  console.log(`  opencode`);
  console.log(`  /novel write --auto ${PROJECT_NAME}\n`);

  console.log(`📊 预期产出:\n`);
  console.log(`  - 6 阶段全流程: 世界观 → 角色 → 大纲 → 初稿 → 修订 → 精修`);
  console.log(`  - 中篇小说: 100,000 ~ 200,000 字`);
  console.log(`  - 自动质量审查 + NCS 遗忘检测\n`);

  console.log(`📋 阶段进度查询:\n`);
  console.log(`  /novel status`);
  console.log(`  /novel write --continue ${PROJECT_NAME}\n`);

  // 4. Run unit tests first
  console.log(`🔍 运行前置单元测试...\n`);
  const { execSync } = await import('node:child_process');
  try {
    execSync('bun test tests/unit/writer/control/ tests/unit/writer/quality/ tests/simulation/', {
      cwd: WORKSPACE_ROOT,
      stdio: 'inherit',
      timeout: 60000,
    });
    console.log(`\n  ✅ 前置测试全部通过\n`);
  } catch {
    console.warn(`\n  ⚠️  前置测试失败，请检查后重试\n`);
    process.exit(1);
  }
}

main().catch(console.error);
