import { logger, pathUtil, fsUtil, executeCommand } from "../../../core/harness-core.ts";

async function main() {
  const args = Deno.args;
  if (args.length < 2) {
    console.log("使用法: deno run -A harness-attach.ts <アカウント名> <プロジェクトディレクトリ>");
    console.log("例: deno run -A harness-attach.ts your-account-name path/to/your/project");
    Deno.exit(1);
  }

  const accountName = args[0];
  const projectDir = pathUtil.resolvePath(args[1]);
  const hostAlias = `github.com-${accountName}`;
  const harnessRoot = pathUtil.resolvePath(Deno.cwd());
  const identityConfig = pathUtil.joinPath(harnessRoot, "config", "identities.txt");

  console.log("--- ハーネスをプロジェクトに装着中 (Harness Attachment) ---");
  console.log(`Project: ${projectDir}`);
  console.log(`Account: ${accountName} (エイリアス ${hostAlias} を使用)`);

  // --- 1. アカウント情報の検索 ---
  if (!(await fsUtil.exists(identityConfig))) {
    logger.error(`${identityConfig} が見つかりません。`);
    logger.error("まず manage-git-identity スキルでアイデンティティを作成してください。");
    Deno.exit(1);
  }

  const configText = await fsUtil.readTextFile(identityConfig);
  const lines = configText.split(/\r?\n/);
  let accountEmail = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${accountName},`)) {
      accountEmail = trimmed.split(",")[1]?.trim() || "";
      break;
    }
  }

  if (!accountEmail) {
    logger.error(`${accountName} に対するメールアドレスの設定が ${identityConfig} に見当たりません。`);
    Deno.exit(1);
  }

  const gitDir = pathUtil.joinPath(projectDir, ".git");
  if (!(await fsUtil.exists(gitDir))) {
    logger.error(`${projectDir} は有効な Git リポジトリではありません。`);
    Deno.exit(1);
  }

  // --- 2. リモート URL の書き換え (SSH エイリアス化) ---
  const getRemoteResult = await executeCommand({
    cmd: "git",
    args: ["remote", "get-url", "origin"],
    cwd: projectDir
  });

  if (getRemoteResult.code !== 0) {
    logger.error("リモートURLの取得に失敗しました。origin が設定されていますか？");
    Deno.exit(1);
  }

  const currentRemote = getRemoteResult.stdout.trim();
  console.log(`現在のリモート: ${currentRemote}`);

  // HTTPS または 標準SSH を、ハーネスで管理しているエイリアス形式へ変換
  const newRemote = currentRemote.replace(
    /^(https:\/\/github\.com\/|git@github\.com:)/,
    `git@${hostAlias}:`
  );

  if (currentRemote === newRemote) {
    console.log("Info: リモート URL は既にエイリアス形式、またはカスタム設定になっています。");
  } else {
    console.log(`リモート URL を更新中: ${newRemote}`);
    const setRemoteResult = await executeCommand({
      cmd: "git",
      args: ["remote", "set-url", "origin", newRemote],
      cwd: projectDir
    });

    if (setRemoteResult.code !== 0) {
      logger.error("リモートURLの更新に失敗しました。");
      Deno.exit(1);
    }
  }

  // --- 3. Git アイデンティティ設定 (プロジェクト内限定) ---
  console.log(`Git アイデンティティを設定中: ${accountName} <${accountEmail}> ...`);
  
  await executeCommand({
    cmd: "git",
    args: ["config", "user.name", accountName],
    cwd: projectDir
  });

  await executeCommand({
    cmd: "git",
    args: ["config", "user.email", accountEmail],
    cwd: projectDir
  });

  console.log(`Success: ${accountName} <${accountEmail}> としてアイデンティティを固定しました。`);
  console.log(`Success: 以後、このプロジェクトでの通信はアカウント ${accountName} を経由します。`);
  console.log("--------------------------------------------------------");
}

if (import.meta.main) {
  main();
}
