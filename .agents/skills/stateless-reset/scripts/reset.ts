import { fsUtil, logger, pathUtil } from "../../../core/harness-core.ts";

async function main() {
  const args = Deno.args;
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  const targetRoot = args.length > 0
    ? args[0]
    : pathUtil.resolvePath(homeDir, ".gemini", "antigravity");

  console.log("--- 記憶のリセットを開始します (Stateless Reset) ---");
  console.log(`ターゲット: ${targetRoot}`);

  let backupDir = "";
  try {
    backupDir = await Deno.makeTempDir({ prefix: `antigravity_context_${Date.now()}_` });
  } catch (e) {
    logger.error(`バックアップディレクトリの作成に失敗しました: ${(e as Error).message}`);
    Deno.exit(1);
  }

  const dirsToReset = ["brain", "knowledge", "conversations"];
  let count = 0;

  for (const dir of dirsToReset) {
    const targetPath = pathUtil.joinPath(targetRoot, dir);
    if (await fsUtil.exists(targetPath)) {
      const backupPath = pathUtil.joinPath(backupDir, dir);
      console.log(`退避中: ${dir} -> ${backupDir}/`);

      try {
        await fsUtil.move(targetPath, backupPath);
        await Deno.mkdir(targetPath, { recursive: true });
        count++;
      } catch (e) {
        logger.error(`退避に失敗しました (${dir}): ${(e as Error).message}`);
      }
    }
  }

  console.log("--------------------------------------------------------");
  console.log(`完了: ${count} 件のディレクトリを退避しました。`);
  console.log(`退避先パス: ${backupDir}`);
  console.log("※ OS による自動クリーンアップまでデータは保持されます。");
  console.log("--------------------------------------------------------");
}

if (import.meta.main) {
  main();
}
