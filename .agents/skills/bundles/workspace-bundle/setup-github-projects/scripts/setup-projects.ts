import { parseArgs } from "@std/cli/parse-args";
import { dirname, fromFileUrl, join } from "@std/path";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const PROJECT_ROOT = join(SCRIPT_DIR, "..", "..", "..", "..", "..", "..");
const CONFIG_PATH = join(PROJECT_ROOT, "config", "identities.md");
const EXPORT_PATH = join(SCRIPT_DIR, "..", "references", "projects-config.json");

interface FieldDef {
  name: string;
  dataType: string;
  options?: string[];
}

const PRODUCT_BACKLOG_FIELDS: FieldDef[] = [
  {
    name: "harness-status",
    dataType: "SINGLE_SELECT",
    options: ["IDEA", "TODO", "WIP", "DONE"],
  },
  {
    name: "harness-size",
    dataType: "SINGLE_SELECT",
    options: ["XS", "S", "M", "L", "XL"],
  },
  {
    name: "harness-priority",
    dataType: "NUMBER",
  },
];

const SPRINT_BOARD_FIELDS: FieldDef[] = [
  {
    name: "harness-status",
    dataType: "SINGLE_SELECT",
    options: ["TODO", "WIP", "DONE"],
  },
  {
    name: "harness-parent",
    dataType: "TEXT",
  },
];

export function parseRepoFromConfig(configPath: string): string {
  const content = Deno.readTextFileSync(configPath);
  const match = content.match(/`git@github\.com:([^/]+)\/([^.]+)\.git`/);
  if (!match) {
    throw new Error(
      `config/identities.md からリポジトリ情報を取得できませんでした。\n` +
        `形式: git@github.com:owner/repo.git が必要です。\n` +
        `または --repo owner/repo を指定してください。`,
    );
  }
  return `${match[1]}/${match[2]}`;
}

export function parseOwner(repo: string): string {
  return repo.split("/")[0];
}

export async function checkProjectScope(): Promise<boolean> {
  const cmd = new Deno.Command("gh", {
    args: ["auth", "status"],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr } = await cmd.output();
  const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);

  if (output.includes("project")) {
    return true;
  }
  console.warn(
    "警告: GitHub トークンに project スコープがありません。\n" +
      "以下のコマンドを実行して project スコープを追加してください：\n" +
      "  gh auth refresh -s project\n" +
      "（ブラウザが開くので指示に従って承認してください）",
  );
  return false;
}

export async function createProjectBoard(
  owner: string,
  title: string,
): Promise<{ number: number; id: string; url: string }> {
  const cmd = new Deno.Command("gh", {
    args: ["project", "create", "--owner", owner, "--title", title, "--format", "json"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const err = new TextDecoder().decode(stderr).trim();
    throw new Error(`ボード作成失敗 [${title}]: ${err}`);
  }

  const result = JSON.parse(new TextDecoder().decode(stdout));
  console.log(`  作成: ${title} (#${result.number})`);
  return result;
}

export async function addCustomField(
  projectNumber: number,
  owner: string,
  field: FieldDef,
): Promise<void> {
  const args = [
    "project",
    "field-create",
    String(projectNumber),
    "--owner",
    owner,
    "--name",
    field.name,
    "--data-type",
    field.dataType,
  ];
  if (field.options) {
    args.push("--single-select-options", field.options.join(","));
  }

  const cmd = new Deno.Command("gh", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();

  if (code !== 0) {
    const err = new TextDecoder().decode(stderr).trim();
    if (err.includes("already exists")) {
      console.log(`  フィールド既存: ${field.name} (スキップ)`);
      return;
    }
    throw new Error(`フィールド作成失敗 [${field.name}]: ${err}`);
  }
  console.log(`  フィールド追加: ${field.name} (${field.dataType})`);
}

export async function linkProjectToRepo(
  projectNumber: number,
  owner: string,
  repo: string,
): Promise<void> {
  const cmd = new Deno.Command("gh", {
    args: ["project", "link", String(projectNumber), "--owner", owner, "--repo", repo],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();

  if (code !== 0) {
    const err = new TextDecoder().decode(stderr).trim();
    if (err.includes("already linked")) {
      console.log(`  リポジトリリンク済み (スキップ)`);
      return;
    }
    throw new Error(`リポジトリリンク失敗: ${err}`);
  }
  console.log(`  リポジトリリンク: ${repo}`);
}

export interface BoardConfig {
  productBacklog: {
    number: number;
    url: string;
    fields: FieldDef[];
  };
  sprintBoard: {
    number: number;
    url: string;
    fields: FieldDef[];
  };
  repo: string;
  createdAt: string;
}

export async function exportConfig(
  config: BoardConfig,
  outputPath: string,
): Promise<void> {
  await Deno.writeTextFile(outputPath, JSON.stringify(config, null, 2));
  console.log(`  構成保存: ${outputPath}`);
}

function printUsage(): void {
  console.log(`Usage: deno run -A scripts/setup-projects.ts [--repo <owner/repo>]

Arguments:
  --repo <owner/repo>  対象リポジトリ（省略時は config/identities.md から自動取得）

Options:
  --help               このメッセージを表示`);
}

export async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["repo"],
    boolean: ["help"],
    alias: { h: "help" },
  });

  if (args.help) {
    printUsage();
    Deno.exit(0);
  }

  let repo: string;
  if (args.repo) {
    repo = args.repo;
  } else {
    try {
      repo = parseRepoFromConfig(CONFIG_PATH);
      console.log(`config/identities.md からリポジトリを読み取りました: ${repo}`);
    } catch (e) {
      console.error(`エラー: ${(e as Error).message}`);
      Deno.exit(1);
    }
  }

  if (repo.split("/").length !== 2) {
    console.error(`エラー: --repo は owner/repo 形式で指定してください。\n  入力値: ${repo}`);
    Deno.exit(1);
  }

  const owner = parseOwner(repo);

  const scopeOk = await checkProjectScope();
  if (!scopeOk) {
    Deno.exit(1);
  }

  console.log(`\n=== Product Backlog ボード作成 ===`);
  const pbBoard = await createProjectBoard(owner, "Product Backlog");
  for (const field of PRODUCT_BACKLOG_FIELDS) {
    await addCustomField(pbBoard.number, owner, field);
  }
  await linkProjectToRepo(pbBoard.number, owner, repo);

  console.log(`\n=== Sprint Board ボード作成 ===`);
  const sbBoard = await createProjectBoard(owner, "Sprint Board");
  for (const field of SPRINT_BOARD_FIELDS) {
    await addCustomField(sbBoard.number, owner, field);
  }
  await linkProjectToRepo(sbBoard.number, owner, repo);

  const config: BoardConfig = {
    productBacklog: {
      number: pbBoard.number,
      url: pbBoard.url,
      fields: PRODUCT_BACKLOG_FIELDS,
    },
    sprintBoard: {
      number: sbBoard.number,
      url: sbBoard.url,
      fields: SPRINT_BOARD_FIELDS,
    },
    repo,
    createdAt: new Date().toISOString(),
  };
  await exportConfig(config, EXPORT_PATH);

  console.log(`\n✅ 完了！
  Product Backlog: ${pbBoard.url}
  Sprint Board:    ${sbBoard.url}
  構成ファイル:    ${EXPORT_PATH}

⚠️  Sprint Board のビュー設定は UI から手動で行ってください：
  1. 「harness-parent」列を追加（Fields → harness-parent）
  2. harness-parent でグループ化（列ヘッダー右クリック → Group by）
  3. マイルストーン列を追加（Fields → Milestone）
  4. フィルタバーに is:open と入力（Closed Issue 非表示）
   操作方法の詳細は references/operation-rules.md を参照してください。`);
}

if (import.meta.main) {
  main();
}
