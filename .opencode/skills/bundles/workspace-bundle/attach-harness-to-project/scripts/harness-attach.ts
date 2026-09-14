import {
  errorUtil,
  executeCommand,
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
  PROJECT_ROOT,
} from "../../../../../core/harness-core.ts";
import { parseArgs } from "@std/cli/parse-args";

/**
 * SSH鍵未登録や接続エラーをチェックし、修復手順を表示する。
 *
 * @param stderr - 標準エラー出力の内容
 * @returns SSH関連のエラーを検出した場合は true、それ以外は false
 */
export function checkSshKeyError(stderr: string): boolean {
  if (
    stderr.includes("Permission denied (publickey)") ||
    stderr.includes("Host key verification failed")
  ) {
    console.log("\n========================================================");
    console.log("⚠️  SSH認証エラーを検出しました (SSH Connection/Key Error)");
    console.log("GitHubへのSSH公開鍵登録、またはSSHエージェントの設定が必要です。");
    console.log("以下のコマンドを実行してSSH公開鍵を登録してください：");
    console.log("  gh ssh-key add <path-to-public-key>");
    console.log("========================================================\n");
    return true;
  }
  return false;
}

async function processProject(project: {
  name: string;
  repo: string;
  path: string;
  account: string;
  email: string;
  visibility?: string;
}, options: { dryRun?: boolean } = {}) {
  try {
    const isDryRun = options.dryRun || false;
    const resolvedPath = pathUtil.expandHome(project.path);
    const hostAlias = `github.com-${project.account}`;

    // SSHエイリアス形式のリモートURLを作成
    const aliasRepo = project.repo.replace(
      /^(https:\/\/github\.com\/|git@github\.com:)/,
      `git@${hostAlias}:`,
    );

    console.log(`\n--- [${project.name}] (${project.account}) ---`);

    // 1. クローンまたはディレクトリ確認
    if (!(await fsUtil.exists(resolvedPath))) {
      console.log(`Info: ターゲットパスが存在しません。クローンを開始します: ${resolvedPath}`);
      const parentDir = pathUtil.dirname(resolvedPath);
      if (!isDryRun) {
        await Deno.mkdir(parentDir, { recursive: true });
      }

      const cloneResult = await executeCommand({
        cmd: "git",
        args: ["clone", aliasRepo, resolvedPath],
        env: {
          // SSH接続時にホストキー未登録によるフリーズ・エラーを防ぐ防御的設計
          // accept-new: 初回接続時のみ自動登録し、以降は既知のホストキーを検証する
          GIT_SSH_COMMAND: "ssh -o StrictHostKeyChecking=accept-new",
        },
        dryRun: isDryRun,
      });

      if (!isDryRun && cloneResult.code !== 0) {
        if (cloneResult.stderr) {
          checkSshKeyError(cloneResult.stderr);
        }
        throw new Error(`クローンに失敗しました: ${project.name}`);
      }
    }

    if (!isDryRun) {
      const gitDir = pathUtil.joinPath(resolvedPath, ".git");
      if (!(await fsUtil.exists(gitDir))) {
        throw new Error(`${resolvedPath} は有効な Git リポジトリではありません。`);
      }
    }

    // 2. リモート URL の同期
    const getRemoteResult = await executeCommand({
      cmd: "git",
      args: ["remote", "get-url", "origin"],
      cwd: resolvedPath,
      dryRun: isDryRun,
    });

    if (isDryRun || getRemoteResult.code === 0) {
      const currentRemote = getRemoteResult.stdout.trim();
      if (isDryRun || currentRemote !== aliasRepo) {
        console.log(`リモート URL をエイリアス形式に更新中: ${aliasRepo}`);
        await executeCommand({
          cmd: "git",
          args: ["remote", "set-url", "origin", aliasRepo],
          cwd: resolvedPath,
          dryRun: isDryRun,
        });
      }
    }

    // 3. Git アイデンティティの強制上書き
    console.log(`Git 設定を同期中: ${project.account} <${project.email}>`);
    await executeCommand({
      cmd: "git",
      args: ["config", "user.name", project.account],
      cwd: resolvedPath,
      dryRun: isDryRun,
    });
    await executeCommand({
      cmd: "git",
      args: ["config", "user.email", project.email],
      cwd: resolvedPath,
      dryRun: isDryRun,
    });

    console.log(`Success: ${project.name} の配備と接続が完了しました。`);
  } catch (e) {
    errorUtil.log(e, project.name);
  }
}

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { d: "dry-run" },
    });
    const isDryRun = args["dry-run"] || false;

    const harnessRoot = PROJECT_ROOT;
    const identityConfig = pathUtil.joinPath(harnessRoot, "config", "identities.md");

    console.log("--- プロジェクト配備・ハーネス装着処理 (Deploy & Attach) ---");
    if (isDryRun) console.log("(DRY RUN MODE)");

    if (!(await fsUtil.exists(identityConfig))) {
      throw new Error(`${identityConfig} が見つかりません。`);
    }

    const content = await fsUtil.readTextFile(identityConfig);
    const h2Titles = mdUtil.getH2Titles(content);

    for (const title of h2Titles) {
      const kv = mdUtil.parseKVListInSection(content, title);

      if (kv["Repository"] && kv["Local Path"] && kv["Account Name"] && kv["User Email"]) {
        await processProject({
          name: title,
          repo: kv["Repository"],
          path: kv["Local Path"],
          account: kv["Account Name"],
          email: kv["User Email"],
          visibility: kv["Visibility"] || "private",
        }, { dryRun: isDryRun });
      } else {
        logger.warn(`セクション "${title}" の設定が不完全なためスキップします。`);
      }
    }

    console.log("\n--------------------------------------------------------");
    console.log("処理が完了しました。");
  } catch (e) {
    errorUtil.fatal(e, "Main");
  }
}

if (import.meta.main) {
  main();
}
