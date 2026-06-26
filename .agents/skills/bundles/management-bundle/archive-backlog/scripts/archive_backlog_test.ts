import { assertFalse, assertMatch, assertThrows } from "@std/assert";
import {
  buildArchiveCard,
  extractPbiBlock,
  loadBacklogSchema,
  updateContents,
  validateWpCompleteness,
} from "../../../../../core/shared/parse/backlog-schema.ts";

// --- Tests for transformToArchiveCard ---

/**
 * buildArchiveCard - 正規フォーマットに準拠したカードが生成されることを検証する。
 * 全フィールドが正しく埋め込まれていることを確認する。
 */
Deno.test("buildArchiveCard - should generate canonical format card", () => {
  const schema = loadBacklogSchema();
  const data: Record<string, unknown> = {
    id: "[Epic/Feature]/Test-PBI-1",
    sprint: "Sprint 1",
    insights: "Learned something new",
    tags: ["#Lesson"],
    metrics: { turns: 5, sessions: 1 },
    outcomes: ["- scripts/test.ts の作成"],
    sizeEstimated: "S",
    sizeActual: "S",
    effortPreplan: 2,
    effortPostplan: 2,
    effortActual: 1,
    wpPlannedAchieved: ["WP_1: AC1"],
    wpPlannedMissed: [],
    wpAddedAchieved: [],
    wpAddedMissed: [],
  };
  const dummyBlock = `### [DONE] [Epic/Feature]/Test-PBI-1`;

  const result = buildArchiveCard(data, dummyBlock, schema);

  assertMatch(result, /\*\*スプリント\*\*: Sprint 1/);
  assertMatch(result, /\*\*見積サイズ\*\*: S/);
  assertMatch(result, /\*\*実感サイズ\*\*: S/);
  assertMatch(result, /計画前見積合計: 2回/);
  assertMatch(result, /計画後見積合計: 2回/);
  assertMatch(result, /完了時実績合計: 1回/);
  assertMatch(result, /`#Lesson`/);
  assertMatch(result, /計画時WPのAC達成状況/);
  assertMatch(result, /\[x\] WP_1: AC1/);
});

// --- Tests for extractPbiBlock ---

/**
 * extractPbiBlock - 指定した PBI ID のブロックを正しく抽出できることを検証する。
 * マークダウン中の該当ブロックと正規表現が返されることを確認する。
 */
Deno.test("extractPbiBlock - should successfully extract a PBI block and return regex", () => {
  const content = `## Sprint 1\n### [DONE] Test-1\nSome details.\n### [TODO] Test-2`;
  const result = extractPbiBlock(content, "Test-1");
  assertMatch(result.block, /### \[DONE\] Test-1/);
  assertMatch(result.block, /Some details\./);
});

/**
 * extractPbiBlock - 存在しない PBI ID を指定した場合にエラーがスローされることを検証する。
 * 異常系として該当PBI不在時の動作を確認する。
 */
Deno.test("extractPbiBlock - should throw error if PBI not found", () => {
  const content = `## Sprint 1\n### [TODO] Test-2`;
  assertThrows(
    () => {
      extractPbiBlock(content, "Test-1");
    },
    Error,
    "PBI not found: Test-1",
  );
});

// --- Tests for updateContents ---

/**
 * updateContents - PBI をバックログから削除し、アーカイブに追記できることを検証する。
 * バックログから対象 PBI が除去され、アーカイブの所定位置に追記されることを確認する。
 */
Deno.test("updateContents - should remove PBI from backlog and append to archive", () => {
  // Using a simplified regex that matches what extractPbiBlock would produce
  const pbiRegex = /### \[DONE\] Test-1[\s\S]*?(?=\n###|$)/;
  const backlog = `## Sprint 1\n### [DONE] Test-1\nDetails\n### [TODO] Test-2\n`;
  const archive = `# Archive\n\n## 完了済みアイテム\n\n### [DONE] Old-PBI\n`;
  const archiveCard = `### [DONE] Test-1\nArchive Details`;

  const result = updateContents(backlog, archive, pbiRegex, archiveCard);

  assertFalse(result.newBacklog.includes("Test-1"));
  assertMatch(result.newBacklog, /### \[TODO\] Test-2/);
  assertMatch(result.newArchive, /## 完了済みアイテム\n### \[DONE\] Test-1\nArchive Details/);
});

/**
 * updateContents - アーカイブに対象アンカーが存在しない場合にエラーがスローされることを検証する。
 * 異常系としてアンカー不在時のエラーハンドリングを確認する。
 */
Deno.test("updateContents - should throw error if anchor not found in archive", () => {
  const backlog = ``;
  const archive = `# Archive\n\nNo anchor here.`;
  const pbiRegex = /.*/;

  assertThrows(
    () => {
      updateContents(backlog, archive, pbiRegex, "Card");
    },
    Error,
    "Anchor '## 完了済みアイテム' not found.",
  );
});

// --- Tests for validateWpCompleteness ---

const pbiWithIncompleteWp = `
### [WIP] [Epic/Feature]/Test-PBI

- **概要**: Test PBI

#### WP_1: Setup infrastructure

- **Effort見積（介入回数）**: 1回
- [x] AC1: Setup done
- [ ] AC2: Verification pending

#### WP_2: Implement feature

- **Effort見積（介入回数）**: 1回
- [x] AC1: Feature implemented
`;

const pbiWithCompleteWp = `
### [WIP] [Epic/Feature]/Test-PBI

- **概要**: Test PBI

#### WP_1: Setup infrastructure

- **Effort見積（介入回数）**: 1回
- [x] AC1: Setup done
- [x] AC2: Verification done

#### WP_a: Additional work

- **Effort見積（介入回数）**: 1回
- [x] AC1: Extra task done
`;

const pbiWithNoWp = `
### [TODO] [Epic/Feature]/Test-PBI

- **概要**: Test PBI with no work packages
`;

const pbiWithAlphaWpIncomplete = `
### [WIP] [Epic/Feature]/Test-PBI

- **概要**: Test PBI

#### WP_a: Additional work

- **Effort見積（介入回数）**: 1回
- [ ] AC1: Extra task pending
`;

Deno.test("validateWpCompleteness - should throw if any WP has incomplete checkbox", () => {
  assertThrows(
    () => validateWpCompleteness(pbiWithIncompleteWp, "[Epic/Feature]/Test-PBI"),
    Error,
    "has incomplete WP: WP_1",
  );
});

Deno.test("validateWpCompleteness - should throw if alphabet-suffixed WP has incomplete checkbox", () => {
  assertThrows(
    () => validateWpCompleteness(pbiWithAlphaWpIncomplete, "[Epic/Feature]/Test-PBI"),
    Error,
    "has incomplete WP: WP_a",
  );
});

Deno.test("validateWpCompleteness - should pass if all WP checkboxes are complete", () => {
  validateWpCompleteness(pbiWithCompleteWp, "[Epic/Feature]/Test-PBI");
});

Deno.test("validateWpCompleteness - should pass if PBI has no WP sections", () => {
  validateWpCompleteness(pbiWithNoWp, "[Epic/Feature]/Test-PBI");
});
