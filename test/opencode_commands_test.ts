/**
 * WP #726 ワークフロー統合（.opencode/commands 集約）検証テスト。
 *
 * 単一の正は `.opencode/commands/*.md` 8本。`.agents/workflows/` は削除済みのため参照しない。
 *
 * ワークフロー追加時の更新手順（プレイブック）:
 *   1. `.opencode/commands/<name>.md` を既存コマンドの複製で作成し、自己完結した手順
 *      （STOPマーカー・フェーズ見出しを持ち、`@.agents/workflows/` 参照を持たない）とする。
 *   2. 新規コマンドの `<!-- STOP -->` 数を `rg -o '<!-- STOP -->' | wc -l` で実測し、
 *      STOP_BASELINE へ登録する（未登録はレジストリテストが失敗させる）。
 *   3. コマンド本文は frontmatter（description 非空・subtask:false の2キーのみ）の構造を維持する。
 *   4. 新規にロール定義を参照する場合は `/.opencode/agents/<role>.md` 実在下のみ可。
 * 反復集合は commands ディレクトリの動的走査から駆動されるため、追加で編集が必要な箇所は ② のみ。
 */
import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/yaml";

const ROOT = new URL("../", import.meta.url).pathname;
const COMMANDS_DIR = `${ROOT}.opencode/commands`;

/**
 * 介入2でロールリンク置換を行ったスキル側ファイル（コマンド以外）。
 */
const SKILL_LINK_FILES: string[] = [
  `${ROOT}.agents/skills/bundles/git-bundle/hybrid-triage-commit/references/hybrid-triage-commit-process.md`,
  `${ROOT}.agents/skills/bundles/management-bundle/session-planning/SKILL.md`,
];

/**
 * コマンド別の `<!-- STOP -->` 数ベースライン（2026-09-12 実測・旧 wf 値と同数）。
 * 合計58。AC4「STOPマーカーは変更不要」の機械的担保。コマンド追加時はプレイブック②で登録し、
 * レジストリテストが commands 実走査との集合同値を強制する。
 */
const STOP_BASELINE: Record<string, number> = {
  "kickoff.md": 6,
  "project-setup.md": 8,
  "refactoring.md": 10,
  "session-end.md": 5,
  "session-start.md": 5,
  "sprint-end.md": 12,
  "sprint-review.md": 3,
  "sprint-start.md": 9,
};

/**
 * テスト実行中は同一内容を返す読み込みキャッシュ（並行呼び出し時は重複読の可能性があるが
 * 内容不変のため無害）。
 */
const fileCache = new Map<string, string>();

/**
 * 対象ファイルの内容を返し、初回読み込み時はキャッシュに保持する。
 *
 * @param path - 読み込むファイルの絶対パス
 * @returns ファイル内容
 */
async function readTarget(path: string): Promise<string> {
  const cached = fileCache.get(path);
  if (cached !== undefined) {
    return cached;
  }
  const content = await Deno.readTextFile(path);
  fileCache.set(path, content);
  return content;
}

/**
 * .opencode/commands 直下のコマンドファイル名一覧（辞書順）。検証対象集合の単一の情報源。
 *
 * @returns `*.md` ファイル名の配列
 */
async function listCommandFiles(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(COMMANDS_DIR)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      names.push(entry.name);
    }
  }
  return names.sort();
}

/**
 * コマンドファイル名（`x.md`）から基底名 `x` を返す。
 *
 * @param file - `.md` 付きファイル名
 * @returns 拡張子を除いた基底名
 */
function baseName(file: string): string {
  return file.replace(/\.md$/, "");
}

/**
 * コマンド本文の絶対パスを返す。
 *
 * @param file - `.md` 付きコマンドファイル名
 * @returns COMMANDS_DIR 配下の絶対パス
 */
function commandPath(file: string): string {
  return `${COMMANDS_DIR}/${file}`;
}

/**
 * レジストリ不変条件: STOP_BASELINE のキー集合と commands ディレクトリの実走査結果が
 * 集合同値であること。新規コマンドの検証素通り（登録漏れ）を失敗として検出する。
 */
Deno.test("STOP baseline registry covers exactly the command set", async () => {
  const commands = await listCommandFiles();
  assertEquals(
    Object.keys(STOP_BASELINE).sort(),
    commands,
    "register new commands in STOP_BASELINE with the measured STOP marker count (playbook step 2)",
  );
});

/**
 * AC4不変条件: 各コマンドの `<!-- STOP -->` 数がベースラインと一致する。
 * 移植前 wf 値（合計58）と同数を commands 側で保証する。
 */
Deno.test("commands keep the STOP marker baseline (AC4 invariance)", async () => {
  for (const [file, expected] of Object.entries(STOP_BASELINE)) {
    const content = await readTarget(commandPath(file));
    const count = (content.match(/<!-- STOP -->/g) ?? []).length;
    assertEquals(
      count,
      expected,
      `${file} must keep exactly ${expected} STOP markers after edits`,
    );
  }
});

/**
 * 介入2残存参照ゼロ化ガード: 置換対象（commands 実走査＋スキル2本）にルート絶対パス
 * `/.agents/rules/` への参照が残っていないこと。相対表記の配置説明は対象外。
 */
Deno.test("role references to the removed .agents/rules dir are eliminated", async () => {
  const commands = await listCommandFiles();
  const targets = [...commands.map((file) => commandPath(file)), ...SKILL_LINK_FILES];
  for (const path of targets) {
    const content = await readTarget(path);
    assert(
      !content.includes("/.agents/rules/"),
      `${path} still references the removed /.agents/rules/ path`,
    );
  }
});

/**
 * 置換先の実在性: 対象中の /.opencode/agents/<role>.md 参照がすべて実ファイルへ
 * 解決すること。total>=65 は commands 63件＋スキル2件の実測65件（2026-09-12）の
 * 下bound（置換漏れ捕捉）。
 */
Deno.test("replaced role links resolve to existing .opencode/agents files", async () => {
  const commands = await listCommandFiles();
  const targets = [...commands.map((file) => commandPath(file)), ...SKILL_LINK_FILES];
  let total = 0;
  for (const path of targets) {
    const content = await readTarget(path);
    for (const match of content.matchAll(/\/\.opencode\/agents\/([a-z-]+)\.md/g)) {
      const target = `${ROOT}.opencode/agents/${match[1]}.md`;
      total += 1;
      assert(
        (await Deno.stat(target)).isFile,
        `${path} links to missing role definition: ${target}`,
      );
    }
  }
  assert(total >= 65, `expected at least 65 replaced role links, found ${total}`);
});

/**
 * 自己完結性: 各コマンドは単一の正として自己完結した手順を持つ。
 * STOPマーカーとフェーズ見出し（`## `）を持ち、`@.agents/workflows/` 参照を持たないこと。
 * H1 は `# /<name> — <タイトル>` 書式であること。旧 AC1 鏡像対応の新構造相当ガード。
 */
Deno.test("commands are self-contained procedures", async () => {
  const commands = await listCommandFiles();
  assert(commands.length > 0, "no commands discovered; check COMMANDS_DIR");
  for (const file of commands) {
    const name = baseName(file);
    const content = await readTarget(commandPath(file));
    assert(
      content.includes("<!-- STOP -->"),
      `${name}.md must contain STOP markers as self-contained procedure`,
    );
    assert(
      /^##\s+.+/m.test(content),
      `${name}.md must have phase headings (## ...)`,
    );
    assert(
      !content.includes("@.agents/workflows/"),
      `${name}.md must not reference the removed @.agents/workflows/ path`,
    );
    const h1 = content.match(/^# (.+)$/m)?.[1] ?? "";
    assert(h1.startsWith(`/${name} — `), `${name}.md H1 must start with "/${name} — "`);
  }
});

/**
 * markdown先頭の YAML frontmatter をキー値マップへ変換する。
 *
 * @param content - frontmatter を含む markdown 本文
 * @returns frontmatter のパーサ結果（先頭ブロックが無い場合は空オブジェクト）
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return {};
  }
  const parsed = parse(match[1]);
  return (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
}

/**
 * 各コマンドは Opencode 形式 frontmatter（description）を持ち、
 * subtask:false が明示設定されている。キーは description/subtask の2つのみ、
 * description は非空文字列であること（比較対象の workflow 原文は存在しない）。
 */
Deno.test("frontmatter has non-empty description and explicit subtask:false", async () => {
  for (const file of await listCommandFiles()) {
    const name = baseName(file);
    const command = await readTarget(commandPath(file));
    const fm = parseFrontmatter(command);
    assertEquals(
      Object.keys(fm).sort(),
      ["description", "subtask"],
      `${name}.md must declare exactly description and subtask`,
    );
    assertEquals(fm.subtask, false, `${name}.md must set subtask: false explicitly`);
    assert(
      typeof fm.description === "string" && fm.description.length > 0,
      `${name}.md must have a non-empty description`,
    );
  }
});
