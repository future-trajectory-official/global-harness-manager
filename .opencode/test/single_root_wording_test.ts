import { assert, assertEquals } from "@std/assert";
import { walk } from "@std/fs/walk";
import { dirname, fromFileUrl, join } from "@std/path";

/**
 * 配布資源の記述が2層構造モデル（グローバル層／リポジトリ固有層）へ統一されていることを検証する。
 * 実行ディレクトリに依存しないよう、走査基点は本ファイルの位置から解決する。
 */
const ROOT = join(dirname(fromFileUrl(import.meta.url)), "../..");

/**
 * AC1 の走査対象ディレクトリ（配布対象の資源）。
 * `core` の GraphQL 用語など別語義は、旧資源モデル表記へ戻さない限り検出されない。
 */
const SCAN_DIRS = [
  ".opencode/commands",
  ".opencode/skills",
  ".opencode/guides",
  ".opencode/agents",
  ".opencode/core",
];

/** 資源モデルを記述する単独ファイル（配布テンプレートと管理概念の正本）。 */
const SCAN_FILES = [
  "README.md",
  "config/AGENTS.md.example",
  ".github/context/management.md",
];

/** テキストとして走査する拡張子（バイナリ資産の混入で誤検知しないための allowlist）。 */
const SCAN_EXTS = [
  ".md",
  ".ts",
  ".tsx",
  ".json",
  ".jsonc",
  ".yml",
  ".yaml",
  ".sh",
  ".txt",
  ".ps1",
  ".toml",
];

/** 2層構造モデル導入前の誤った資源モデル表記。 */
const LEGACY_WORDING = "単一ルート";

/**
 * 指定ディレクトリ配下のテキストファイルを再帰収集する。
 * @param relDir - 走査基点ディレクトリ（リポジトリルート相対）
 * @returns 収集したファイルの絶対パス一覧
 */
async function collectFiles(relDir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of walk(join(ROOT, relDir), { exts: SCAN_EXTS })) {
    if (entry.isFile) {
      files.push(entry.path);
    }
  }
  return files;
}

/**
 * ユースケース: 配布資源の記述が2層構造モデルへ統一されている
 * 検証意図: commands / skills / guides（および配布対象の agents / core）と資源モデル文書に
 *           「単一ルート」表現が1件も残存しないこと（AC1）。走査対象が空になった場合の
 *           空振り合格を防ぐため、対象ディレクトリの実在と件数も検証する。
 */
Deno.test("AC1: 配布資源に旧「単一ルート」表記が残存しない", async () => {
  const targets: string[] = [];
  for (const dir of SCAN_DIRS) {
    const files = await collectFiles(dir);
    assert(files.length > 0, `走査対象が空です: ${dir}`);
    targets.push(...files);
  }
  targets.push(...SCAN_FILES.map((file) => join(ROOT, file)));

  const hits: string[] = [];
  for (const file of targets) {
    const content = await Deno.readTextFile(file);
    content.split("\n").forEach((line, index) => {
      if (line.includes(LEGACY_WORDING)) {
        hits.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assertEquals(hits, [], `旧表現「単一ルート」が残存しています:\n${hits.join("\n")}`);
});
