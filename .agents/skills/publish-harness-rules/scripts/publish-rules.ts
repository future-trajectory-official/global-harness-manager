import {
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
  verifyTarget,
  errorUtil,
} from "../../../core/harness-core.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * .agents/rules/*.md を指定のプロジェクトへ配布するスクリプト
 */

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run", "force"],
      alias: { d: "dry-run", f: "force" },
    });

    const isDryRun = args["dry-run"] || false;
    const force = args["force"] || false;
    const configPath = pathUtil.resolvePath("config/publish-rules-targets.md");
    const rulesSourceDir = pathUtil.resolvePath(".agents/rules");

    if (!(await fsUtil.exists(configPath))) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const content = await fsUtil.readTextFile(configPath);

    // ターゲットプロジェクトの抽出 (H3)
    const targetPaths = mdUtil.getTitlesInSection(content, "Target Projects", 3);
    // 対象ルールの抽出 (H3)
    const ruleNames = mdUtil.getTitlesInSection(content, "Target Rules", 3);

    if (targetPaths.length === 0 || ruleNames.length === 0) {
      logger.warn("No targets or rules found in config.");
      return;
    }

    logger.info(`Found ${targetPaths.length} targets and ${ruleNames.length} rules.`);

    for (const rawPath of targetPaths) {
      const targetPath = pathUtil.expandHome(rawPath);
      const targetRulesDir = pathUtil.joinPath(targetPath, ".agents/rules");

      logger.info(`Processing target: ${targetPath}`);

      // 安全性検証
      const safety = await verifyTarget.checkSafety(targetPath);
      if (!safety.safe && !force) {
        logger.warn(`Skip target "${targetPath}": ${safety.reason}`);
        logger.info("Use --force to ignore this safety check.");
        continue;
      }

      // ターゲットのルールディレクトリ作成
      if (!isDryRun) {
        try {
          await Deno.mkdir(targetRulesDir, { recursive: true });
        } catch (e) {
          if (!(e instanceof Deno.errors.AlreadyExists)) {
            errorUtil.log(e, `Dir creation: ${targetRulesDir}`);
            continue;
          }
        }
      }

      for (const ruleName of ruleNames) {
        const sourceFile = pathUtil.joinPath(rulesSourceDir, `${ruleName}.md`);
        const targetFile = pathUtil.joinPath(targetRulesDir, `${ruleName}.md`);

        if (!(await fsUtil.exists(sourceFile))) {
          logger.warn(`Source rule not found: ${sourceFile}. Skipping.`);
          continue;
        }

        logger.info(`  Copying rule: ${ruleName}`);
        const ruleContent = await fsUtil.readTextFile(sourceFile);
        await fsUtil.writeTextFile(targetFile, ruleContent, isDryRun);
      }
    }

    logger.info("Publish rules completed.");
  } catch (e) {
    errorUtil.fatal(e, "Publish Rules Main");
  }
}

if (import.meta.main) {
  main();
}
