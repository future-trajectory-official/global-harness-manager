import { assertEquals, assertExists } from "@std/assert";

const SKILL_DIR = new URL("..", import.meta.url).pathname;
const SKILL_MD = `${SKILL_DIR}/SKILL.md`;
const REFERENCE_MD = `${SKILL_DIR}/references/reference.md`;
const INPUT_SCHEMA_MD = `${SKILL_DIR}/references/input-schema.md`;

function parseYamlFrontmatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, unknown> = {};
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim();
  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) result.description = descMatch[1].trim();
  const catMatch = yaml.match(/category:\s*(.+)$/m);
  if (catMatch) result.category = catMatch[1].trim();
  return result;
}

/**
 * ユースケース: SKILL.md の対話手順（AC2）が定義されていることの検証。
 * 検証意図: read-project-state スキルが PO への問いかけに対して一貫した対話手順
 * （3点提示方式）をリファレンスに定義していることを保証する。
 */
Deno.test({
  name: "SKILL.md should exist and be readable",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    assertExists(content);
  },
});

/**
 * ユースケース: SKILL.md の YAML frontmatter が正しいことの検証。
 * 検証意図: スキルの発見性（CSO）を保証するため、name と category が正しく設定されている。
 */
Deno.test({
  name: "SKILL.md YAML frontmatter should have correct fields",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    const fm = parseYamlFrontmatter(content);
    assertEquals(fm.name, "read-project-state");
    assertEquals(fm.category, "management");
  },
});

/**
 * ユースケース: 3点提示方式の対話手順が定義されていることの検証。
 * 検証意図: PO への問いかけ形式が「1:<何を> 2:<探す|調べる> 3:<どんな条件で>」の
 * 3点提示方式で定義されており、対話が一貫して進行できることを保証する。
 */
Deno.test({
  name: "reference.md should define the 3-point dialog prompt procedure",
  fn: async () => {
    const content = await Deno.readTextFile(REFERENCE_MD);
    assertExists(content.match(/1:<何を>/), "1:<何を> not found");
    assertExists(content.match(/2:<探す\|調べる>/), "2:<探す|調べる> not found");
    assertExists(content.match(/3:<どんな条件で>/), "3:<どんな条件で> not found");
    assertExists(content.match(/探す.*search/s), "search mapping not found");
    assertExists(content.match(/調べる.*find/s), "find mapping not found");
  },
});

/**
 * ユースケース: チャット表示形式（一覧表示・詳細表示）が定義されていることの検証。
 * 検証意図: search 結果の一覧表示（number/title/状態）と find 結果の詳細表示
 * （title/body/AC本文/状態/labels）のフォーマットがリファレンスに定義されていることを保証する。
 */
Deno.test({
  name: "reference.md should define chat display formats for search and find",
  fn: async () => {
    const content = await Deno.readTextFile(REFERENCE_MD);
    assertExists(content.match(/一覧表示/), "search list display not defined");
    assertExists(content.match(/詳細表示/), "find detail display not defined");
    assertExists(content.match(/number/), "number field not in display format");
    assertExists(content.match(/title/), "title field not in display format");
    assertExists(content.match(/labels/), "labels field not in display format");
  },
});

/**
 * ユースケース: エラー時の表示規則が定義されていることの検証。
 * 検証意図: 対象外エラー（Vision/ProductGoal の search）・未実装エラー
 * （Retrospective）・検索0件・code不明などのエラー時の振る舞いが定義されていることを保証する。
 */
Deno.test({
  name: "reference.md should define error handling display rules",
  fn: async () => {
    const content = await Deno.readTextFile(REFERENCE_MD);
    assertExists(content.match(/対象外/), "unsupported search error not defined");
    assertExists(content.match(/Retrospective/), "Retrospective not-implemented error not defined");
    assertExists(content.match(/0件/), "zero-result handling not defined");
    assertExists(content.match(/code不明/), "unknown code handling not defined");
  },
});

/**
 * ユースケース: SKILL.md がリファレンスを参照していることの検証。
 * 検証意図: SKILL.md が表示形式・対話手順を reference.md から引き、入力スキーマを
 * input-schema.md から引く構成を保証する。詳細を SKILL.md に直書きしない。
 */
Deno.test({
  name: "SKILL.md should reference sidecar reference files instead of inlining details",
  fn: async () => {
    const content = await Deno.readTextFile(SKILL_MD);
    assertExists(content.match(/references\/reference\.md/), "reference.md link not found");
    assertExists(content.match(/references\/input-schema\.md/), "input-schema.md link not found");
    const reference = await Deno.readTextFile(REFERENCE_MD);
    const schema = await Deno.readTextFile(INPUT_SCHEMA_MD);
    assertExists(reference);
    assertExists(schema);
  },
});
