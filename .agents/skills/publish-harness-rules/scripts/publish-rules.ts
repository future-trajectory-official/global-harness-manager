import {
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
} from "../../../core/harness-core.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * .agents/rules/*.md を指定のプロジェクトへ配布するスクリプト
 */

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["dry-run"],
    alias: { d: "dry-run" },
  });

  const isDryRun = args["dry-run"] || false;
  const configPath = pathUtil.resolvePath("config/publish-rules-targets.md");
  const rulesSourceDir = pathUtil.resolvePath(".agents/rules");

  if (!(await fsUtil.exists(configPath))) {
    logger.error(`Config file not found: ${configPath}`);
    Deno.exit(1);
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

    if (!(await fsUtil.exists(targetPath))) {
      logger.warn(`Target path does not exist: ${targetPath}. Skipping.`);
      continue;
    }

    // ターゲットのルールディレクトリ作成
    if (!isDryRun) {
      try {
        await Deno.mkdir(targetRulesDir, { recursive: true });
      } catch (e) {
        if (!(e instanceof Deno.errors.AlreadyExists)) {
          const message = e instanceof Error ? e.message : String(e);
          logger.error(`Failed to create directory ${targetRulesDir}: ${message}`);
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
}

if (import.meta.main) {
  main();
}
