import {
  executeCommand,
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
} from "../../../core/harness-core.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * ワークスペース内のスキルをグローバルディレクトリへ同期するスクリプト
 */

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["dry-run"],
    alias: { d: "dry-run" },
  });

  const isDryRun = args["dry-run"] || false;
  const configPath = pathUtil.resolvePath("config/publish-targets.md");
  const globalPathFile = pathUtil.resolvePath("config/global-skills-path.txt");
  const skillsSourceDir = pathUtil.resolvePath(".agents/skills");

  if (!(await fsUtil.exists(configPath))) {
    logger.error(`Config file not found: ${configPath}`);
    Deno.exit(1);
  }

  if (!(await fsUtil.exists(globalPathFile))) {
    logger.error(`Global path file not found: ${globalPathFile}`);
    Deno.exit(1);
  }

  // グローバルディレクトリパスの取得
  const globalPathContent = await fsUtil.readTextFile(globalPathFile);
  const globalRawPath = globalPathContent
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  if (!globalRawPath) {
    logger.error("No valid path found in global-skills-path.txt");
    Deno.exit(1);
  }

  const globalDestDir = pathUtil.resolvePath(globalRawPath);
  logger.info(`Global destination: ${globalDestDir}`);

  // 公開対象スキルの抽出 (H2)
  const mdContent = await fsUtil.readTextFile(configPath);
  const skillNames = mdUtil.getH2Titles(mdContent);

  if (skillNames.length === 0) {
    logger.warn("No skills found in publish-targets.md");
    return;
  }

  logger.info(`Found ${skillNames.length} skills to publish.`);

  if (!isDryRun) {
    try {
      await Deno.mkdir(globalDestDir, { recursive: true });
    } catch (e) {
      // 既に存在していてもエラーにしない
      if (!(e instanceof Deno.errors.AlreadyExists)) {
        logger.error(`Failed to create directory ${globalDestDir}: ${e.message}`);
        Deno.exit(1);
      }
    }
  }

  for (const skillName of skillNames) {
    const sourceDir = pathUtil.joinPath(skillsSourceDir, skillName);

    if (!(await fsUtil.exists(sourceDir))) {
      logger.warn(`Source skill not found: ${sourceDir}. Skipping.`);
      continue;
    }

    logger.info(`  Syncing skill: ${skillName}`);

    // cp -r を使用してディレクトリごと同期
    await executeCommand({
      cmd: "cp",
      args: ["-r", sourceDir, globalDestDir],
      dryRun: isDryRun,
    });
  }

  logger.info("Publish skills completed.");
}

if (import.meta.main) {
  main();
}
