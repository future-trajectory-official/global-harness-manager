import { parseArgs } from "@std/cli/parse-args";
import { parse } from "@std/yaml";
import { dirname, fromFileUrl, join } from "@std/path";

const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const YAML_PATH = join(SCRIPT_DIR, "..", "references", "label-definitions.yaml");

interface LabelDef {
  name: string;
  color: string;
  description: string;
}

interface LabelDefs {
  labels: LabelDef[];
}

function printUsage(): void {
  console.log(`Usage: deno run -A scripts/setup-labels.ts --repo <owner/repo> --mode safe|force

Arguments:
  --repo <owner/repo>  対象リポジトリ（例: owner/repo）[必須]
  --mode safe|force    動作モード [必須]
    safe:  競合する既存ラベルが1つでもあれば全体を作成せず中断
    force: 既存ラベルを全て削除してから全ラベルを作成

Options:
  --help               このメッセージを表示`);
}

async function getExistingLabels(repo: string): Promise<Set<string>> {
  const cmd = new Deno.Command("gh", {
    args: ["label", "list", "--repo", repo, "--json", "name"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errMsg = new TextDecoder().decode(stderr).trim();
    if (errMsg.includes("not authenticated") || errMsg.includes("HTTP 403")) {
      console.error(`認証エラー: gh CLI の認証状態を確認してください。\n  gh auth status`);
    } else if (errMsg.includes("not found") || errMsg.includes("HTTP 404")) {
      console.error(`リポジトリが見つかりません: ${repo}`);
    } else {
      console.error(`gh label list の実行に失敗しました:\n  ${errMsg}`);
    }
    Deno.exit(1);
  }

  const json = JSON.parse(new TextDecoder().decode(stdout));
  return new Set(json.map((entry: { name: string }) => entry.name));
}

async function createLabel(repo: string, label: LabelDef): Promise<void> {
  const cmd = new Deno.Command("gh", {
    args: [
      "label",
      "create",
      label.name,
      "--repo",
      repo,
      "--color",
      label.color,
      "--description",
      label.description,
      "--force",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  if (code !== 0) {
    console.error(`ラベル作成失敗 [${label.name}]:\n  ${new TextDecoder().decode(stderr).trim()}`);
    Deno.exit(1);
  }
}

async function deleteLabel(repo: string, name: string): Promise<void> {
  const cmd = new Deno.Command("gh", {
    args: ["label", "delete", name, "--repo", repo, "--yes"],
    stdout: "piped",
    stderr: "piped",
  });
  await cmd.output();
}

async function runSafeMode(repo: string, defs: LabelDef[]): Promise<void> {
  const existing = await getExistingLabels(repo);
  const defNames = new Set(defs.map((l) => l.name));
  const conflicts = [...existing].filter((name) => defNames.has(name));

  if (conflicts.length > 0) {
    console.error(`競合する既存ラベルが ${conflicts.length} 個見つかりました。
--mode force で再実行すると全て上書きします。

競合ラベル一覧:`);
    for (const name of conflicts) {
      console.error(`  - ${name}`);
    }
    Deno.exit(1);
  }

  for (const label of defs) {
    await createLabel(repo, label);
    console.log(`  ${label.name}`);
  }
}

async function runForceMode(repo: string, defs: LabelDef[]): Promise<void> {
  const existing = await getExistingLabels(repo);
  const defNames = new Set(defs.map((l) => l.name));
  const toDelete = [...existing].filter((name) => defNames.has(name));

  if (toDelete.length > 0) {
    console.log(`既存ラベルを ${toDelete.length} 個削除します...`);
    for (const name of toDelete) {
      await deleteLabel(repo, name);
      console.log(`  deleted: ${name}`);
    }
  }

  console.log(`\nラベルを ${defs.length} 個作成します...`);
  for (const label of defs) {
    await createLabel(repo, label);
    console.log(`  ${label.name}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["repo", "mode"],
    boolean: ["help"],
    alias: { h: "help" },
  });

  if (args.help) {
    printUsage();
    Deno.exit(0);
  }

  if (!args.repo) {
    console.error("エラー: --repo は必須です。");
    printUsage();
    Deno.exit(1);
  }

  if (args.repo.split("/").length !== 2) {
    console.error(
      `エラー: --repo は owner/repo 形式で指定してください（例: owner/repo）。\n  入力値: ${args.repo}`,
    );
    Deno.exit(1);
  }

  if (args.mode !== "safe" && args.mode !== "force") {
    console.error("エラー: --mode は safe または force を指定してください。");
    printUsage();
    Deno.exit(1);
  }

  let yamlContent: string;
  try {
    yamlContent = await Deno.readTextFile(YAML_PATH);
  } catch {
    console.error(`エラー: ラベル定義ファイルが見つかりません。\n  期待パス: ${YAML_PATH}`);
    Deno.exit(1);
  }

  let defs: LabelDefs;
  try {
    defs = parse(yamlContent) as LabelDefs;
  } catch (e) {
    console.error(`エラー: YAML パースに失敗しました。\n  ${e}`);
    Deno.exit(1);
  }

  if (!defs?.labels?.length) {
    console.error("エラー: ラベル定義が空です。YAML の labels セクションを確認してください。");
    Deno.exit(1);
  }

  console.log(`リポジトリ: ${args.repo}`);
  console.log(`モード: ${args.mode}`);
  console.log(`定義ラベル数: ${defs.labels.length}\n`);

  if (args.mode === "safe") {
    await runSafeMode(args.repo, defs.labels);
  } else {
    await runForceMode(args.repo, defs.labels);
  }

  console.log(`\n完了: ${defs.labels.length} 個のラベルを処理しました。`);
}

if (import.meta.main) {
  main();
}
