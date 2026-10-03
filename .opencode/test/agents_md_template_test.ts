import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { basename, dirname, fromFileUrl, join } from "@std/path";

/**
 * 存続ファイル (config/AGENTS.md.example) のみ検証する縮退テスト。旧配布スキルのテンプレート検証は AC-2 で廃止。
 */

/** このテストファイルの位置から解決したリポジトリルートディレクトリ */
const REPO_ROOT = join(dirname(fromFileUrl(import.meta.url)), "../..");

/** ローカル規律テンプレート（プロジェクト配布用 AGENTS.md の源）の絶対パス */
const LOCAL_AGENTS_EXAMPLE_PATH = join(REPO_ROOT, "config", "AGENTS.md.example");

/** ローカル規律（config/AGENTS.md.example）の本文を読み込むヘルパー（T4/T5で再利用） */
async function readLocalAgentsExample(): Promise<string> {
  return await Deno.readTextFile(LOCAL_AGENTS_EXAMPLE_PATH);
}

/** ハーネス慣習としてローカル example へ移設済みの事項キー（AC4。HITL対象操作リストの4項目を含む） */
const REQUIRED_LOCAL_CONVENTION_KEYS = [
  ".session/task.md",
  ".session/plan.md",
  "[Phase",
  "[CRITICAL ACTION]",
  ".opencode/context",
  "git push",
  "一括置換",
  "ホストOS",
  "deno.json",
] as const;

/**
 * ユースケース: ハーネス慣習（.session管理・Phase宣言・HITL具体手段・用語集参照）がローカル規律へ移設されている（AC4）
 * 検証意図: config/AGENTS.md.example が移設項目（HITL対象操作リスト4項目を含む）をすべて含み、グローバル昇格した「設計品質デフォルト基準」をローカル側から除去済みであることを確認する
 */
Deno.test("T4 (AC4): local example hosts migrated harness conventions", async () => {
  const content = await readLocalAgentsExample();
  for (const key of REQUIRED_LOCAL_CONVENTION_KEYS) {
    assertStringIncludes(content, key);
  }
  assert(
    !content.includes("設計品質デフォルト基準"),
    "設計品質デフォルト基準はグローバルへ昇格済みのためローカルから削除する必要があります",
  );
});

/**
 * ユースケース: 用語集参照が opencode.json.example の instructions と整合する（AC4）
 * 検証意図: instructions の全項目について、AGENTS.md（=local example の配布実体名）または .opencode/context 連鎖がローカル規律で担保されることを総称的に検証し、用語集2ファイル（management.md / product.md）への言及を確認する
 * （旧T5末尾のグローバルテンプレート参照断片は参照先廃止のためAC-2で削除）
 */
Deno.test("T5 (AC4): glossary reference chain aligns with opencode.json.example", async () => {
  const instructionsJson = JSON.parse(
    await Deno.readTextFile(join(REPO_ROOT, "config", "opencode.json.example")),
  ) as { instructions?: string[] };
  const instructions: string[] = instructionsJson.instructions ?? [];
  assert(instructions.length > 0, "instructions が空です");

  const localContent = await readLocalAgentsExample();
  for (const entry of instructions) {
    const covered = entry === "AGENTS.md"
      ? basename(LOCAL_AGENTS_EXAMPLE_PATH) === "AGENTS.md.example"
      : localContent.includes(entry.replace(/\/\*\.[^/]+$/, ""));
    assert(covered, `instructions の ${entry} に対応する参照連鎖がローカル規律で担保されません`);
  }

  assertStringIncludes(localContent, "management.md");
  assertStringIncludes(localContent, "product.md");
});

/**
 * ユースケース: 配布実体 (config/AGENTS.md.example) が単一の文書として健全である
 * 検証意図: H1 見出しが唯一であり、文書の起点が "# Project Context" であることを確認する
 */
Deno.test("T6: local example has exactly one H1 heading", async () => {
  const content = await readLocalAgentsExample();
  const h1Lines = content.split("\n").filter((line) => line.startsWith("# "));
  assertEquals(h1Lines.length, 1, "H1 見出しは唯一でなければなりません");
  assertEquals(h1Lines[0], "# Project Context");
});

/**
 * ユースケース: 配布実体 (config/AGENTS.md.example) の見出し階層が正しく段階を踏む
 * 検証意図: 見出しレベルの飛び級（例: ## から ####）がなく、文書構造が壊れていないことを確認する
 */
Deno.test("T7: local example has no heading level jumps", async () => {
  const content = await readLocalAgentsExample();
  const levels = content.split("\n")
    .filter((line) => /^#{1,4} /.test(line))
    .map((line) => line.match(/^(#{1,4}) /)?.[1].length ?? 0);
  assert(levels.length > 0, "見出しが存在しません");
  assertEquals(levels[0], 1, "文書は H1 から始まらなければなりません");
  for (let i = 1; i < levels.length; i++) {
    assert(
      levels[i] <= levels[i - 1] + 1,
      `見出し階層の飛び級を検出: H${levels[i - 1]} → H${levels[i]} (index ${i})`,
    );
  }
});

/**
 * ユースケース: 配布実体 (config/AGENTS.md.example) に未展開のテンプレート式が残らない
 * 検証意図: example は展開式ではなく配布実体そのものであるため、mustache 式 ({{...}}) を含まないことを確認する
 */
Deno.test("T8: local example contains no unexpanded template expressions", async () => {
  const content = await readLocalAgentsExample();
  assert(
    !content.includes("{{"),
    "配布実体に未展開のテンプレート式 {{ が残っています",
  );
  assert(
    !content.includes("}}"),
    "配布実体に未展開のテンプレート式 }} が残っています",
  );
});
