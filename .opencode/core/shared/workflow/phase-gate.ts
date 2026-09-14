import { join, resolve } from "@std/path";
import { parseArgs } from "@std/cli/parse-args";
import { logger } from "../io/logger.ts";
import { type BundlePathValue, PATHS, PROJECT_ROOT } from "../types/constants.ts";
import { errorUtil } from "../types/error.ts";

/**
 * SKILL.md の内容から `[text](path)` 形式のリンクを抽出する。
 * 以下のリンクは対象外とする：
 * - URL（http://, https://）
 * - アンカーのみ（#section）
 * - 画像リンク（![alt](path)）
 */
export function extractLinksFromSkillMd(content: string): string[] {
  const links: string[] = [];
  const regex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const path = match[2].trim();

    if (path.startsWith("http://") || path.startsWith("https://")) {
      continue;
    }

    if (path.startsWith("#")) {
      continue;
    }

    if (path.length > 0) {
      links.push(path);
    }
  }

  return links;
}

/**
 * リンクパスを絶対パスへ解決する。
 * 相対パスはスキルディレクトリ基準、絶対パス（先頭 /）はプロジェクトルート基準で解決する。
 * アンカー（#section）が含まれる場合は除去する。
 */
export function resolveReferencePath(
  linkPath: string,
  skillDir: string,
  projectRoot: string,
): string {
  let cleanPath = linkPath;

  const hashIndex = cleanPath.indexOf("#");
  if (hashIndex >= 0) {
    cleanPath = cleanPath.substring(0, hashIndex);
  }

  if (cleanPath.startsWith("/")) {
    return join(projectRoot, cleanPath);
  }

  if (cleanPath.startsWith("./")) {
    return resolve(skillDir, cleanPath);
  }

  return resolve(skillDir, cleanPath);
}

/**
 * 読了ログと照合し、未読ファイルの絶対パス一覧を返す。
 */
export function checkReadStatus(
  files: string[],
  readLog: Record<string, string[]>,
  skillName: string,
): string[] {
  const readFiles = readLog[skillName] || [];
  const readSet = new Set(readFiles);

  return files.filter((f) => !readSet.has(f));
}

/**
 * 全バンドルから指定されたスキル名のディレクトリを検索する。
 * SKILL.md が存在するディレクトリをスキルディレクトリとみなす。
 */
export async function resolveSkillDir(
  skillName: string,
): Promise<string | null> {
  const bundles: BundlePathValue[] = [
    PATHS.BUNDLES.ONBOARDING,
    PATHS.BUNDLES.GIT,
    PATHS.BUNDLES.META,
    PATHS.BUNDLES.DEVELOPMENT,
    PATHS.BUNDLES.MANAGEMENT,
  ];

  for (const bundle of bundles) {
    const skillDir = join(PROJECT_ROOT, PATHS.SKILLS_ROOT, bundle, skillName);
    try {
      const stat = await Deno.stat(join(skillDir, "SKILL.md"));
      if (stat.isFile) {
        return skillDir;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * CLI 引数をパースする。
 */
export function parseCliArgs(args: string[]): { step: string } {
  const parsed = parseArgs(args, {
    string: ["step"],
    alias: { s: "step" },
  });

  if (!parsed.step) {
    throw new Error("--step オプションは必須です。使用例: phase-gate --step <skill-name>");
  }

  return { step: parsed.step };
}

async function main() {
  const args = parseCliArgs(Deno.args.slice());

  const skillDir = await resolveSkillDir(args.step);
  if (!skillDir) {
    errorUtil.fatal(`スキル "${args.step}" が見つかりませんでした。`);
    return;
  }

  const skillMdPath = join(skillDir, "SKILL.md");
  let content: string;
  try {
    content = await Deno.readTextFile(skillMdPath);
  } catch {
    errorUtil.fatal(`SKILL.md の読み込みに失敗しました: ${skillMdPath}`);
    return;
  }

  const rawLinks = extractLinksFromSkillMd(content);
  if (rawLinks.length === 0) {
    Deno.exit(0);
  }

  const resolvedFiles = rawLinks.map((link) => resolveReferencePath(link, skillDir, PROJECT_ROOT));

  let readLog: Record<string, string[]> = {};
  try {
    const readLogContent = await Deno.readTextFile(
      join(PROJECT_ROOT, ".session", ".read-log.json"),
    );
    readLog = JSON.parse(readLogContent);
  } catch {
    readLog = {};
  }

  const unreadFiles = checkReadStatus(resolvedFiles, readLog, args.step);

  if (unreadFiles.length > 0) {
    logger.warn(
      `[phase-gate] 以下のファイルが未読です。読了後に再試行してください:`,
    );
    for (const file of unreadFiles) {
      logger.warn(`  - ${file}`);
    }
    Deno.exit(1);
  }

  Deno.exit(0);
}

if (import.meta.main) {
  main();
}
