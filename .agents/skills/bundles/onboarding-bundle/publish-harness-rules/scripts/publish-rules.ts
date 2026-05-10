import {
  errorUtil,
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
  verifyTarget,
} from "../../../../../core/harness-core.ts";
import { parseArgs } from "@std/cli/parse-args";

/**
 * .agents/rules/*.md を指定のプロジェクトへ配布するスクリプト
 */

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      string: ["lang", "os"],
      boolean: ["dry-run", "force", "append"],
      alias: { d: "dry-run", f: "force" },
    });

    const isDryRun = args["dry-run"] || false;
    const force = args["force"] || false;
    let lang = args["lang"];
    let osEnv = args["os"];
    const isAppend = args["append"] || false;

    // 設定ファイルからのプリセット読み込み (引数がない場合)
    if (!lang || !osEnv) {
      const globalSettingsPath = pathUtil.resolvePath("config/global-settings.md");
      if (await fsUtil.exists(globalSettingsPath)) {
        const settingsContent = await fsUtil.readTextFile(globalSettingsPath);
        lang = lang || mdUtil.getTitlesInSection(settingsContent, "Language", 3)[0];
        osEnv = osEnv || mdUtil.getTitlesInSection(settingsContent, "Environment", 3)[0];
        if (lang || osEnv) {
          logger.info(
            `Using preset settings from ${globalSettingsPath}: lang=${lang}, os=${osEnv}`,
          );
        }
      }
    }

    // GEMINI.md 同期処理 (引数またはプリセットが指定されている場合のみ実行)
    if (lang || osEnv) {
      await syncGlobalPrompt(lang, osEnv, isAppend, isDryRun);
    }

    const configPath = pathUtil.resolvePath("config/publish-rules-targets.md");
    const rulesSourceDir = pathUtil.resolvePath(".agents/rules");

    if (!(await fsUtil.exists(configPath))) {
      logger.warn(`Config file not found: ${configPath}. Skipping project rules sync.`);
    } else {
      const content = await fsUtil.readTextFile(configPath);

      // ターゲットプロジェクトの抽出 (H3)
      const targetPaths = mdUtil.getTitlesInSection(content, "Target Projects", 3);
      // 対象ルールの抽出 (H3)
      const ruleNames = mdUtil.getTitlesInSection(content, "Target Rules", 3);

      if (targetPaths.length > 0 && ruleNames.length > 0) {
        logger.info(`Found ${targetPaths.length} targets and ${ruleNames.length} rules.`);

        for (const rawPath of targetPaths) {
          const targetPath = pathUtil.expandHome(rawPath);
          const targetRulesDir = pathUtil.joinPath(targetPath, ".agents/rules");

          logger.info(`Processing target: ${targetPath}`);

          // 安全性検証
          const safety = await verifyTarget.checkSafety(targetPath);
          if (!safety.safe && !force) {
            logger.warn(`Skip target "${targetPath}": ${safety.reason}`);
            continue;
          }

          // ターゲットのルールディレクトリ作成
          if (!isDryRun) {
            await Deno.mkdir(targetRulesDir, { recursive: true }).catch((e) => {
              if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
            });
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
      }
    }

    logger.info("Publish rules completed.");
  } catch (e) {
    errorUtil.fatal(e, "Publish Rules Main");
  }
}

/**
 * ~/.gemini/GEMINI.md をテンプレートに基づいて構築・同期します
 */
async function syncGlobalPrompt(
  lang: string | undefined,
  osEnv: string | undefined,
  append: boolean,
  isDryRun: boolean,
) {
  const geminiPath = pathUtil.expandHome("~/.gemini/GEMINI.md");
  const templatePath = pathUtil.resolvePath(
    ".agents/skills/bundles/onboarding-bundle/publish-harness-rules/references/GEMINI.md.template",
  );

  if (osEnv && osEnv !== "wsl" && osEnv !== "linux") {
    throw new Error(`Not implemented: OS environment "${osEnv}" is not supported yet.`);
  }

  if (!(await fsUtil.exists(templatePath))) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  let templateContent = await fsUtil.readTextFile(templatePath);

  // 環境説明文のマッピング定義
  const ENV_DESCRIPTIONS: Record<string, Record<string, string>> = {
    wsl: {
      ja:
        "本プロジェクトは Windowsから接続された**WSL環境** で運用されています。ターミナル操作を行う際は、必ず **bash** の構文を使用してください。",
      en:
        "This project is running in a **WSL environment** connected from Windows. Always use **bash** syntax for terminal operations.",
    },
    linux: {
      ja: "本プロジェクトは標準的な **Linux環境** で運用されています。",
      en: "This project is running in a standard **Linux environment**.",
    },
  };

  const currentLang = lang === "ja" ? "ja" : "en";
  const currentOs = (osEnv === "wsl" || osEnv === "linux") ? osEnv : "linux"; // デフォルトは linux

  const langDesc = currentLang === "ja"
    ? "チャット内の応答やプログレスメッセージ、成果物のプラン、タスク、ウォークスルーを日本語で表示する。"
    : "Display chat responses, progress messages, artifacts, tasks, and walkthroughs in English.";

  const envDesc = ENV_DESCRIPTIONS[currentOs][currentLang];

  templateContent = templateContent
    .replace("{{LANGUAGE_DESCRIPTION}}", langDesc)
    .replace("{{ENVIRONMENT_DESCRIPTION}}", envDesc);

  if (append && (await fsUtil.exists(geminiPath))) {
    const currentContent = await fsUtil.readTextFile(geminiPath);
    if (currentContent.includes("Safety Guardrails")) {
      logger.info("GEMINI.md already has safety guardrails. Skipping append.");
    } else {
      logger.info(`Appending safety guardrails to ${geminiPath}`);
      // セーフティセクションを抽出して追記
      const safetySectionMatch = templateContent.match(
        /## Safety Guardrails & Context Sync[\s\S]*/,
      );
      if (safetySectionMatch) {
        await fsUtil.writeTextFile(
          geminiPath,
          currentContent + "\n\n" + safetySectionMatch[0],
          isDryRun,
        );
      }
    }
  } else {
    logger.info(`${append ? "Creating" : "Overwriting"} ${geminiPath}`);
    // ディレクトリ作成
    if (!isDryRun) {
      await Deno.mkdir(pathUtil.dirname(geminiPath), { recursive: true }).catch((e) => {
        if (!(e instanceof Deno.errors.AlreadyExists)) throw e;
      });
    }
    await fsUtil.writeTextFile(geminiPath, templateContent, isDryRun);
  }
}

if (import.meta.main) {
  main();
}
