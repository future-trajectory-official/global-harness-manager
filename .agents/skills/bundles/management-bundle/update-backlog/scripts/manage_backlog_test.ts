import { assertFalse, assertMatch, assertThrows } from "@std/assert";
import {
  BacklogData,
  extractPbiBlock,
  transformToArchiveCard,
  updateContents,
} from "./manage_backlog.ts";

// --- Tests for transformToArchiveCard ---

/**
 * transformToArchiveCard - スプリントメタデータが提供された場合に
 * アーカイブカードに「完了スプリント」行が含まれることを検証する。
 * メタデータの正しい反映を確認する。
 */
Deno.test("transformToArchiveCard - should include sprint metadata when provided", () => {
  const data: BacklogData = {
    id: "Test-PBI-1",
    insights: "Learned something new",
    tags: ["#Lesson"],
    metrics: { turns: 5, sessions: 1 },
    outcomes: ["Test output"],
    summary: "A test PBI",
    sprint: "Sprint 1",
  };
  const dummyBlock = `### [DONE] Test-PBI-1\n**概要**: A test PBI`;

  const result = transformToArchiveCard(data, dummyBlock);
  assertMatch(result, /- \*\*完了スプリント\*\*: Sprint 1/);
  assertMatch(result, /- \*\*当初の概要\*\*: A test PBI/);
});

/**
 * transformToArchiveCard - スプリント情報が未提供の場合に「完了スプリント」行が
 * 省略されることを検証する。任意フィールドの省略時の動作を確認する。
 */
Deno.test("transformToArchiveCard - should omit sprint line when sprint is not provided", () => {
  const data: BacklogData = {
    id: "Test-PBI-2",
    insights: "No sprint metadata",
    tags: ["#Troubleshooting"],
    metrics: { turns: 2, sessions: 1 },
    outcomes: [],
  };
  const dummyBlock = `### [DONE] Test-PBI-2`;

  const result = transformToArchiveCard(data, dummyBlock);

  assertFalse(
    result.includes("**完了スプリント**"),
    "Should not include sprint line if sprint is undefined",
  );
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
