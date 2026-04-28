import { fsUtil, logger, pathUtil } from "../../../core/harness-core.ts";

const FILES = [
  "config/identities.txt",
  "config/global-skills-path.txt",
  "config/publish-rules-targets.md",
  "config/publish-targets.md",
];

async function main() {
  let missing = false;
  logger.info("🔍 設定ファイルの事前チェックを開始します...");

  for (const file of FILES) {
    const fullPath = pathUtil.resolvePath(Deno.cwd(), file);

    const exists = await fsUtil.exists(fullPath);
    if (!exists) {
      logger.error(`❌ ファイルがありません: ${file}`);
      logger.error(`   (※ ${file}.example 等をコピーして作成してください)`);
      missing = true;
      continue;
    }

    try {
      const stat = await Deno.stat(fullPath);
      if (stat.size === 0) {
        logger.warn(`⚠️ ファイルが空です: ${file}`);
        missing = true;
      } else {
        logger.info(`✅ ${file} の存在を確認しました。`);
      }
    } catch (e) {
      logger.error(`❌ ファイルの読み取りに失敗しました: ${file} (${(e as Error).message})`);
      missing = true;
    }
  }

  if (missing) {
    console.log("\n🚨 [FAILED] 必要な設定ファイルが不足しているか、情報が記入されていません。");
    console.log("各ファイルをプロジェクト要件に合わせて作成・記入した上で、再度実行してください。");
    Deno.exit(1);
  }

  console.log("\n🎉 全ての設定ファイルの準備が完了しています！");
  Deno.exit(0);
}

if (import.meta.main) {
  main();
}
