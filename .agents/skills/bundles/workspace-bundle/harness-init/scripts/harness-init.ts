/**
 * harness-init: GitHubリポジトリ新規作成スクリプト
 *
 * config/identities.md からアカウント情報とVisibilityを読み取り、
 * gh repo create --add-readme によりGitHub上にリポジトリを作成する。
 */
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
 * identities.md の1セクションから抽出されたプロジェクト設定。
 */
interface ProjectConfig {
  name: string;
  repo: string;
  path: string;
  account: string;
  email: string;
  visibility: string;
}

/**
 * Repository URLから owner/repo を抽出する。
 * SSH形式（git@github.com:owner/repo.git）および
 * HTTPS形式（https://github.com/owner/repo）に対応。
 *
 * @param url - Repository URL
 * @returns owner/repo 形式の文字列。抽出できない場合はnull
 */
export function extractRepoOwner(url: string): string | null {
  const sshMatch = url.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[1];

  const httpsMatch = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  return null;
}

/**
 * identities.md をパースし、全プロジェクト設定を抽出する。
 * Visibility 未指定時は "private" をデフォルト値とする。
 * 必須フィールド（Repository / Local Path / Account Name / User Email）が
 * 不足しているエントリはスキップする。
 *
 * @param configPath - identities.md のパス
 * @returns プロジェクト設定の配列
 */
export async function parseIdentities(configPath: string): Promise<ProjectConfig[]> {
  const content = await fsUtil.readTextFile(configPath);
  const h2Titles = mdUtil.getH2Titles(content);
  const projects: ProjectConfig[] = [];

  for (const title of h2Titles) {
    const kv = mdUtil.parseKVListInSection(content, title);

    if (kv["Repository"] && kv["Local Path"] && kv["Account Name"] && kv["User Email"]) {
      projects.push({
        name: title,
        repo: kv["Repository"],
        path: kv["Local Path"],
        account: kv["Account Name"],
        email: kv["User Email"],
        visibility: kv["Visibility"] || "private",
      });
    } else {
      logger.warn(`セクション "${title}" の設定が不完全なためスキップします。`);
    }
  }

  return projects;
}

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { d: "dry-run" },
    });
    const isDryRun = args["dry-run"] || false;

    const identityConfig = pathUtil.joinPath(PROJECT_ROOT, "config", "identities.md");

    console.log("--- リポジトリ作成処理 (harness-init) ---");
    if (isDryRun) console.log("(DRY RUN MODE)");

    if (!(await fsUtil.exists(identityConfig))) {
      throw new Error(`${identityConfig} が見つかりません。`);
    }

    const projects = await parseIdentities(identityConfig);

    for (const project of projects) {
      try {
        const ownerRepo = extractRepoOwner(project.repo);
        if (!ownerRepo) {
          logger.warn(
            `セクション "${project.name}" のRepository URL形式が不正なためスキップします。`,
          );
          continue;
        }

        console.log(`\n--- [${project.name}] (${ownerRepo}) ---`);

        // 同名リポジトリの存在確認
        const viewResult = await executeCommand({
          cmd: "gh",
          args: ["repo", "view", ownerRepo, "--json", "name"],
          dryRun: isDryRun,
        });

        if (!isDryRun && viewResult.code === 0) {
          console.log(
            `Error: リポジトリ '${ownerRepo}' は既にGitHub上に存在します。上書きは行いません。`,
          );
          continue;
        }

        const visibility = project.visibility || "private";

        console.log(
          `リポジトリを作成中: ${ownerRepo} (${visibility})`,
        );

        const createResult = await executeCommand({
          cmd: "gh",
          args: ["repo", "create", ownerRepo, `--${visibility}`, "--add-readme"],
          dryRun: isDryRun,
        });

        if (!isDryRun && createResult.code !== 0) {
          console.log(
            `Error: リポジトリ '${ownerRepo}' の作成に失敗しました。`,
          );
          if (createResult.stderr) {
            console.log(createResult.stderr);
          }
        } else if (isDryRun) {
          console.log(`[DRY RUN] リポジトリ '${ownerRepo}' を作成します`);
        } else {
          console.log(`Success: リポジトリ '${ownerRepo}' を作成しました。`);
        }
      } catch (e) {
        errorUtil.log(e, project.name);
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
