import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  buildArchiveCard,
  extractPbiBlock,
  loadBacklogSchema,
  updateContents,
} from "./backlog-schema.ts";

const EXAMPLE_BACKLOG_PATH = ".agents/management/product-backlog.md.example";
const EXAMPLE_ARCHIVE_PATH = ".agents/management/product-backlog-archive.md.example";

const mockBacklog = `
# プロダクトバックログ

## プロダクトゴール
...

## スプリントバックログ

### [DONE] [Epic/Feature]/Target-PBI

- **概要**: このタスクの目的です。
- **見積サイズ**: S
- **証明方法**: テスト

#### WP_1: タスク1

- **Effort見積（介入回数）**: 1回
- [x] AC1
- [x] AC2

### [TODO] [Next/Feature]/Other-PBI
...
`;

Deno.test("loadBacklogSchema - should parse .example file and build schema", () => {
  const schema = loadBacklogSchema(EXAMPLE_BACKLOG_PATH);

  assertEquals(typeof schema, "object");
  assertEquals(schema.fields.length > 0, true);
  assertEquals(schema.archiveFields.length > 0, true);
  assertEquals(schema.sections.length > 0, true);
});

Deno.test("loadBacklogSchema - should throw error if .example file not found", () => {
  assertThrows(
    () => loadBacklogSchema("non-existent-file.example"),
    Error,
  );
});

Deno.test("extractPbiBlock - should extract a PBI block by ID", () => {
  const schema = loadBacklogSchema(EXAMPLE_BACKLOG_PATH);
  const pbiId = "[Epic/Feature]/Target-PBI";
  const { block } = extractPbiBlock(mockBacklog, pbiId, schema);

  assertStringIncludes(block, "Target-PBI");
  assertStringIncludes(block, "AC1");
});

Deno.test("extractPbiBlock - should throw error if PBI not found", () => {
  const schema = loadBacklogSchema(EXAMPLE_BACKLOG_PATH);
  assertThrows(
    () => extractPbiBlock(mockBacklog, "Non-Existent-PBI", schema),
    Error,
  );
});

Deno.test("buildArchiveCard - should generate canonical format card", () => {
  const schema = loadBacklogSchema(EXAMPLE_ARCHIVE_PATH);
  const pbiId = "[Epic/Feature]/Target-PBI";
  const { block } = extractPbiBlock(mockBacklog, pbiId, loadBacklogSchema(EXAMPLE_BACKLOG_PATH));

  const data: Record<string, unknown> = {
    id: "[Epic/Feature]/Target-PBI",
    sprint: "Sprint 1",
    insights: "Test insight",
    tags: ["#Decision", "#Architecture"],
    outcomes: ["- scripts/test.ts の作成"],
    sizeEstimated: "S",
    sizeActual: "S",
    effortPreplan: 2,
    effortPostplan: 2,
    effortActual: 1,
    wpPlannedAchieved: ["WP_1: AC1", "WP_1: AC2"],
    wpPlannedMissed: [],
    wpAddedAchieved: [],
    wpAddedMissed: [],
  };

  const result = buildArchiveCard(data, block, schema);

  assertStringIncludes(result, "`#Decision`");
  assertStringIncludes(result, "`#Architecture`");
  assertStringIncludes(result, "**スプリント**: Sprint 1");
  assertStringIncludes(result, "**見積サイズ**: S");
  assertStringIncludes(result, "**実感サイズ**: S");
  assertStringIncludes(result, "計画前見積合計: 2回");
  assertStringIncludes(result, "計画後見積合計: 2回");
  assertStringIncludes(result, "完了時実績合計: 1回");
});

Deno.test("updateContents - should remove PBI from backlog and append to archive", () => {
  const pbiRegex = /### \[DONE\] Test-1[\s\S]*?(?=\n###|$)/;
  const backlog = "## Sprint 1\n### [DONE] Test-1\nDetails\n### [TODO] Test-2\n";
  const archive = "# Archive\n\n## 完了済みアイテム\n\n### [DONE] Old-PBI\n";
  const archiveCard = "### [DONE] Test-1\nArchive Details";

  const result = updateContents(backlog, archive, pbiRegex, archiveCard);

  assertEquals(result.newBacklog.includes("Test-1"), false);
  assertStringIncludes(result.newBacklog, "### [TODO] Test-2");
  assertStringIncludes(
    result.newArchive,
    "## 完了済みアイテム\n### [DONE] Test-1\nArchive Details",
  );
});

Deno.test("updateContents - should throw error if anchor not found in archive", () => {
  assertThrows(
    () => updateContents("", "# Archive\nNo anchor here", /.*/, "Card"),
    Error,
    "Anchor '## 完了済みアイテム' not found.",
  );
});
