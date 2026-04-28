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

Deno.test("mdUtil.getH2Titles - should extract all H2 titles", () => {
  const titles = mdUtil.getH2Titles(sampleMd);
  assertEquals(titles, ["Section 1", "Section 2", "Section 3"]);
});

Deno.test("mdUtil.getTitlesInSection - should extract level 3 titles in Section 2", () => {
  const titles = mdUtil.getTitlesInSection(sampleMd, "Section 2", 3);
  assertEquals(titles, ["Sub 1", "Sub 2"]);
});

Deno.test("mdUtil.getTitlesInSection - should return empty for non-existent section", () => {
  const titles = mdUtil.getTitlesInSection(sampleMd, "Non Existent", 3);
  assertEquals(titles, []);
});

Deno.test("mdUtil.parseKVListInSection - should parse KV pairs in Section 1", () => {
  const kv = mdUtil.parseKVListInSection(sampleMd, "Section 1");
  assertEquals(kv, {
    "Key 1": "Value 1",
    "Key 2": "Value 2",
  });
});

Deno.test("mdUtil.parseKVListInSection - should parse KV pairs in last section", () => {
  const kv = mdUtil.parseKVListInSection(sampleMd, "Section 3");
  assertEquals(kv, {
    "Key 3": "Value 3",
  });
});

Deno.test("mdUtil.parseKVListInSection - should handle malformed lists", () => {
  const malformedMd = "## Malformed\n- **NoColon** value\n- Just a list item\n- **EmptyValue**: ";
  const kv = mdUtil.parseKVListInSection(malformedMd, "Malformed");
  assertEquals(kv, {});
});
