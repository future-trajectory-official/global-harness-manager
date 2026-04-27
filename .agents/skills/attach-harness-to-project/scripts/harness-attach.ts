import { logger, pathUtil, fsUtil, executeCommand } from "../../../core/harness-core.ts";

async function processProject(project: {
  name: string;
  repo: string;
  path: string;
  account: string;
  email: string;
}) {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  const resolvedPath = project.path.replace(/^~/, homeDir);
  const hostAlias = `github.com-${project.account}`;
  
  // SSHエイリアス形式のリモートURLを作成
  const aliasRepo = project.repo.replace(
    /^(https:\/\/github\.com\/|git@github\.com:)/,
    `git@${hostAlias}:`
  );

  console.log(`\n--- [${project.name}] (${project.account}) ---`);

  // 1. クローンまたはディレクトリ確認
  if (!(await fsUtil.exists(resolvedPath))) {
    console.log(`Info: ターゲットパスが存在しません。クローンを開始します: ${resolvedPath}`);
    const parentDir = pathUtil.dirname(resolvedPath);
    await Deno.mkdir(parentDir, { recursive: true });

    const cloneResult = await executeCommand({
      cmd: "git",
      args: ["clone", aliasRepo, resolvedPath],
    });

    if (cloneResult.code !== 0) {
      logger.error(`クローンに失敗しました: ${project.name}`);
      return;
    }
  }

  const gitDir = pathUtil.joinPath(resolvedPath, ".git");
  if (!(await fsUtil.exists(gitDir))) {
    logger.error(`エラー: ${resolvedPath} は有効な Git リポジトリではありません。スキップします。`);
    return;
  }

  // 2. リモート URL の同期
  const getRemoteResult = await executeCommand({
    cmd: "git",
    args: ["remote", "get-url", "origin"],
    cwd: resolvedPath
  });

  if (getRemoteResult.code === 0) {
    const currentRemote = getRemoteResult.stdout.trim();
    if (currentRemote !== aliasRepo) {
      console.log(`リモート URL をエイリアス形式に更新中: ${aliasRepo}`);
      await executeCommand({
        cmd: "git",
        args: ["remote", "set-url", "origin", aliasRepo],
        cwd: resolvedPath
      });
    }
  }

  // 3. Git アイデンティティの強制上書き
  console.log(`Git 設定を同期中: ${project.account} <${project.email}>`);
  await executeCommand({ cmd: "git", args: ["config", "user.name", project.account], cwd: resolvedPath });
  await executeCommand({ cmd: "git", args: ["config", "user.email", project.email], cwd: resolvedPath });

  console.log(`Success: ${project.name} の配備と接続が完了しました。`);
}

async function main() {
  const harnessRoot = pathUtil.resolvePath(Deno.cwd());
  const identityConfig = pathUtil.joinPath(harnessRoot, "config", "identities.md");

  console.log("--- プロジェクト配備・ハーネス装着処理 (Deploy & Attach) ---");

  if (!(await fsUtil.exists(identityConfig))) {
    logger.error(`${identityConfig} が見つかりません。`);
    return;
  }

  const content = await fsUtil.readTextFile(identityConfig);
  const sections = content.split(/^##\s+/m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0].trim().replace(/^\[|\]$/g, "");
    
    const repoMatch = section.match(/-\s+\*\*Repository\*\*:\s+`(.+?)`/);
    const pathMatch = section.match(/-\s+\*\*Local Path\*\*:\s+`(.+?)`/);
    const accountMatch = section.match(/-\s+\*\*Account Name\*\*:\s+`(.+?)`/);
    const emailMatch = section.match(/-\s+\*\*User Email\*\*:\s+`(.+?)`/);

    if (repoMatch && pathMatch && accountMatch && emailMatch) {
      await processProject({
        name,
        repo: repoMatch[1].trim(),
        path: pathMatch[1].trim(),
        account: accountMatch[1].trim(),
        email: emailMatch[1].trim(),
      });
    }
  }

  console.log("\n--------------------------------------------------------");
  console.log("処理が完了しました。");
}

if (import.meta.main) {
  main();
}
