import { fsUtil, logger, pathUtil } from "../../../../../core/harness-core.ts";

export const DEFAULT_FILES = [
  "config/identities.md",
  "config/global-skills-path.txt",
  "config/publish-rules-targets.md",
  "config/publish-targets.md",
];

/**
 * 指定されたディレクトリ内のファイル群が存在し、空でないかチェックする
 */
export async function checkFiles(baseDir: string, files: string[]): Promise<boolean> {
  let allPresent = true;
  for (const file of files) {
    const fullPath = pathUtil.resolvePath(baseDir, file);

    const exists = await fsUtil.exists(fullPath);
    if (!exists) {
      logger.error(`❌ ファイルがありません: ${file}`);
      allPresent = false;
      continue;
    }

    try {
      const stat = await Deno.stat(fullPath);
      if (stat.size === 0) {
        logger.warn(`⚠️ ファイルが空です: ${file}`);
        allPresent = false;
      }
    } catch (e) {
      logger.error(`❌ ファイルの読み取りに失敗しました: ${file} (${(e as Error).message})`);
      allPresent = false;
    }
  }
  return allPresent;
}

async function main() {
  logger.info("🔍 設定ファイルの事前チェックを開始します...");

  const ok = await checkFiles(Deno.cwd(), DEFAULT_FILES);

  if (!ok) {
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
