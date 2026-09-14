import { assertEquals } from "@std/assert";
import { mdUtil } from "./markdown.ts";

const sampleMd = `
# Title
Intro text

## Section 1
- Item 1
- **Key 1**: Value 1
- **Key 2**: \`Value 2\`

## Section 2
### Sub 1
### Sub 2

## Section 3
- **Key 3**: Value 3
`;

/**
 * mdUtil.getH2Titles - Markdown から全 H2 見出しを正しく抽出できることを検証する。
 * サンプルMarkdownの ## Section 1〜3 が配列として取得できることを確認する。
 */
Deno.test("mdUtil.getH2Titles - should extract all H2 titles", () => {
  const titles = mdUtil.getH2Titles(sampleMd);
  assertEquals(titles, ["Section 1", "Section 2", "Section 3"]);
});

/**
 * mdUtil.getTitlesInSection - 指定セクション内の指定レベルの見出しを抽出できることを検証する。
 * Section 2 内の ### Sub 1, ### Sub 2 が取得できることを確認する。
 */
Deno.test("mdUtil.getTitlesInSection - should extract level 3 titles in Section 2", () => {
  const titles = mdUtil.getTitlesInSection(sampleMd, "Section 2", 3);
  assertEquals(titles, ["Sub 1", "Sub 2"]);
});

/**
 * mdUtil.getTitlesInSection - 存在しないセクション名を指定した場合に空配列を返すことを検証する。
 * 異常系として、存在しないセクションの指定に対する挙動を確認する。
 */
Deno.test("mdUtil.getTitlesInSection - should return empty for non-existent section", () => {
  const titles = mdUtil.getTitlesInSection(sampleMd, "Non Existent", 3);
  assertEquals(titles, []);
});

/**
 * mdUtil.parseKVListInSection - セクション内の Key-Value リストを正しくパースすることを検証する。
 * Section 1 の `- **Key 1**: Value 1` 形式がオブジェクトに変換されることを確認する。
 */
Deno.test("mdUtil.parseKVListInSection - should parse KV pairs in Section 1", () => {
  const kv = mdUtil.parseKVListInSection(sampleMd, "Section 1");
  assertEquals(kv, {
    "Key 1": "Value 1",
    "Key 2": "Value 2",
  });
});

/**
 * mdUtil.parseKVListInSection - 末尾セクションの KV リストも正しくパースできることを検証する。
 * 最後のセクションに配置された KV ペアが欠落なく抽出されることを確認する。
 */
Deno.test("mdUtil.parseKVListInSection - should parse KV pairs in last section", () => {
  const kv = mdUtil.parseKVListInSection(sampleMd, "Section 3");
  assertEquals(kv, {
    "Key 3": "Value 3",
  });
});

/**
 * mdUtil.parseKVListInSection - 不正な形式のリストに対して空オブジェクトを返すことを検証する。
 * コロンがない、または値が空の KV 形式をパースした場合の異常系動作を確認する。
 */
Deno.test("mdUtil.parseKVListInSection - should handle malformed lists", () => {
  const malformedMd = "## Malformed\n- **NoColon** value\n- Just a list item\n- **EmptyValue**: ";
  const kv = mdUtil.parseKVListInSection(malformedMd, "Malformed");
  assertEquals(kv, {});
});
