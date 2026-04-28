import {
  errorUtil,
  executeCommand,
  fsUtil,
  logger,
  mdUtil,
  pathUtil,
} from "../../../core/harness-core.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

async function processProject(project: {
  name: string;
  repo: string;
  path: string;
  account: string;
  email: string;
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
        dryRun: isDryRun,
      });

      if (!isDryRun && cloneResult.code !== 0) {
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

    const harnessRoot = pathUtil.resolvePath(Deno.cwd());
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
