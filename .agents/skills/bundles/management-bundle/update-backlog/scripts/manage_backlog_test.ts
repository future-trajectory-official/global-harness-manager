import { assertFalse, assertMatch, assertThrows } from "@std/assert";
import {
  BacklogData,
  extractPbiBlock,
  transformToArchiveCard,
  updateContents,
} from "./manage_backlog.ts";

// --- Tests for transformToArchiveCard ---

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

Deno.test("extractPbiBlock - should successfully extract a PBI block and return regex", () => {
  const content = `## Sprint 1\n### [DONE] Test-1\nSome details.\n### [TODO] Test-2`;
  const result = extractPbiBlock(content, "Test-1");
  assertMatch(result.block, /### \[DONE\] Test-1/);
  assertMatch(result.block, /Some details\./);
});

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
