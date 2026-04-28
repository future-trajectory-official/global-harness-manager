import {
  errorUtil,
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
  verifyTarget,
} from "../../../core/harness-core.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * ワークスペース内のスキルをグローバルディレクトリへ同期するスクリプト
 */

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run", "force"],
      alias: { d: "dry-run", f: "force" },
    });

    const isDryRun = args["dry-run"] || false;
    const force = args["force"] || false;
    const configPath = pathUtil.resolvePath("config/publish-targets.md");
    const globalPathFile = pathUtil.resolvePath("config/global-skills-path.txt");
    const skillsSourceDir = pathUtil.resolvePath(".agents/skills");

    if (!(await fsUtil.exists(configPath))) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    if (!(await fsUtil.exists(globalPathFile))) {
      throw new Error(`Global path file not found: ${globalPathFile}`);
    }

    // グローバルディレクトリパスの取得
    const globalPathContent = await fsUtil.readTextFile(globalPathFile);
    const globalRawPath = globalPathContent
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));

    if (!globalRawPath) {
      throw new Error("No valid path found in global-skills-path.txt");
    }

    const globalDestDir = pathUtil.resolvePath(globalRawPath);
    logger.info(`Global destination: ${globalDestDir}`);

    // 配布先の安全確認 (Git リポジトリの場合は dirty check)
    if (await verifyTarget.isGitRepo(globalDestDir)) {
      if (await verifyTarget.isDirty(globalDestDir) && !force) {
        logger.warn(`Destination "${globalDestDir}" is a dirty git repository. Skipping.`);
        logger.info("Use --force to ignore this.");
        return;
      }
    }

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
        if (!(e instanceof Deno.errors.AlreadyExists)) {
          errorUtil.log(e, `Dir creation: ${globalDestDir}`);
          Deno.exit(1);
        }
      }
    }

    for (const skillName of skillNames) {
      const sourceDir = pathUtil.joinPath(skillsSourceDir, skillName);
      const targetDir = pathUtil.joinPath(globalDestDir, skillName);

      if (!(await fsUtil.exists(sourceDir))) {
        logger.warn(`Source skill not found: ${sourceDir}. Skipping.`);
        continue;
      }

      logger.info(`  Syncing skill: ${skillName}`);

      if (isDryRun) {
        logger.dryRun(`Copy directory: ${sourceDir} -> ${targetDir}`);
      } else {
        await fsUtil.copy(sourceDir, targetDir);
      }
    }

    logger.info("Publish skills completed.");
  } catch (e) {
    errorUtil.fatal(e, "Publish Skills Main");
  }
}

if (import.meta.main) {
  main();
}
