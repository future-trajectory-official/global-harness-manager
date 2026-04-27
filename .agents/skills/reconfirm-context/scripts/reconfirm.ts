import { logger, pathUtil, fsUtil } from "../../../core/harness-core.ts";

async function extractFrontmatter(filePath: string): Promise<string> {
  try {
    const text = await fsUtil.readTextFile(filePath);
    const lines = text.split(/\r?\n/);
    const result: string[] = [];
    let count = 0;
    
    for (const line of lines) {
      if (line.match(/^---[\s]*$/)) {
        count++;
        result.push(line);
        if (count === 2) break;
        continue;
      }
      if (count > 0) {
        result.push(line);
      }
    }
    
    if (count === 2) {
      return result.join("\n");
    }
  } catch (_e) {
    // ignore
  }
  return "";
}

async function processSkillRoot(basePath: string, categoryName: string) {
  if (!(await fsUtil.exists(basePath))) return;

  try {
    for await (const dirEntry of Deno.readDir(basePath)) {
      if (dirEntry.isDirectory) {
        const skillDirPath = pathUtil.joinPath(basePath, dirEntry.name);
        const skillMdPath = pathUtil.joinPath(skillDirPath, "SKILL.md");
        if (await fsUtil.exists(skillMdPath)) {
          const frontmatter = await extractFrontmatter(skillMdPath);
          if (frontmatter) {
            console.log(`### ${dirEntry.name} (${categoryName})`);
            console.log(frontmatter);
            console.log("");
          }
        }
      }
    }
  } catch (_e) {
    // ignore
  }
}

async function main() {
  console.log("=== コンテキスト再確認 (ルールとスキルのインデックス) ===\n");

  console.log("## [ルール / 役割]");

  const homeDir = Deno.env.get("HOME") || "";
  const globalGemini = pathUtil.resolvePath(homeDir, ".gemini", "GEMINI.md");
  
  if (await fsUtil.exists(globalGemini)) {
    console.log(`### GEMINI.md (最優先事項 / 憲法)`);
    try {
      const text = await fsUtil.readTextFile(globalGemini);
      const lines = text.split(/\r?\n/).slice(0, 20);
      for (const line of lines) {
        console.log(`  ${line}`);
      }
      console.log("");
    } catch (_e) {
      // ignore
    }
  }

  const rulesDir = ".agents/rules";
  if (await fsUtil.exists(rulesDir)) {
    try {
      for await (const dirEntry of Deno.readDir(rulesDir)) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".md")) {
          const rulePath = pathUtil.joinPath(rulesDir, dirEntry.name);
          const frontmatter = await extractFrontmatter(rulePath);
          if (frontmatter) {
            const basename = dirEntry.name.replace(/\.md$/, "");
            console.log(`### ${basename}`);
            console.log(frontmatter);
            console.log("");
          }
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  console.log("## [スキル / 能力]");

  const skillsTxt = pathUtil.resolvePath(homeDir, ".gemini", "antigravity", "skills.txt");
  if (await fsUtil.exists(skillsTxt)) {
    try {
      const text = await fsUtil.readTextFile(skillsTxt);
      const paths = text.split(/\r?\n/);
      for (const p of paths) {
        const trimmed = p.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          await processSkillRoot(trimmed, "グローバル");
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  const localSkillsDir = ".agents/skills";
  if (await fsUtil.exists(localSkillsDir)) {
    await processSkillRoot(localSkillsDir, "プロジェクト固有");
  }

  console.log("\n=== 再確認完了 ===");
}

if (import.meta.main) {
  main();
}
