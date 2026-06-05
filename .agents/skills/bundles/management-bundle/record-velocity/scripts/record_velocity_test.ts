import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  buildTableRow,
  parseSprintMetrics,
  type SprintMetrics,
  updateBacklogFile,
} from "./record_velocity.ts";

const MOCK_ARCHIVE = `# プロダクトバックログアーカイブ

---

## 完了済みアイテム

### [DONE] [SprintReview]/Sprint-5-Feature-X

- **完了日**: 2026-06-05
- **スプリント**: Sprint 5
- **見積サイズ**: S
- **実感サイズ**: S
- **成果物**:
  - [example.ts](example.ts)
- **Effort実績 (介入回数)**:
  - 計画前見積合計: 1回
  - 計画後見積合計: 1回
  - 完了時実績合計: 1回
- **予実差分析**: 妥当。
- **カテゴリ**: \`#Efficiency\`

### [DONE] [Infrastructure]/Sprint-5-Feature-Y

- **完了日**: 2026-06-05
- **スプリント**: Sprint 5
- **見積サイズ**: M
- **実感サイズ**: M
- **成果物**:
  - [example.ts](example.ts)
- **Effort実績 (介入回数)**:
  - 計画前見積合計: 2回
  - 計画後見積合計: 2回
  - 完了時実績合計: 2回
- **予実差分析**: 妥当。
- **カテゴリ**: \`#Architecture\`

### [DONE] [OtherSprint]/Feature-Z

- **完了日**: 2026-06-01
- **スプリント**: Sprint 4
- **見積サイズ**: XS
- **実感サイズ**: S
- **成果物**:
  - [example.ts](example.ts)
- **Effort実績 (介入回数)**:
  - 計画前見積合計: 1回
  - 計画後見積合計: 1回
  - 完了時実績合計: 2回
- **予実差分析**: 乖離あり。
- **カテゴリ**: \`#Lesson\`
`;

const MOCK_BACKLOG_HEADER = `# プロダクトバックログ

## 推奨スプリントウェイト上限

| 推奨スプリントウェイト上限 | 基準スプリント | 策定日     |
| :------------------------- | :------------- | :--------- |
| **6** (現行)               | Sprint 1       | 2026-06-01 |

| スプリント | 開発PBI数 | 合計ウェイト | 実感サイズ一致率 | 備考                     |
| :--------- | :-------: | :----------: | :------------: | :----------------------- |
| Sprint 1   |    13     |      —       |     全一致     | 基盤構築スプリント       |
| Sprint 2   |     4     |      7       |     全一致     | 上限超過も全完遂         |
| Sprint 3   |     3     |      6       |    概ね一致    | 上限値での安定的消化     |
| Sprint 4   |     4     |      7       |    一部乖離    | 規律違反起因で乖離       |
`;

/** 正常系: 複数PBIが全て見積=実感のスプリントを集計し、合計ウェイト5(S=2+M=3)、一致率1.0を確認する */
Deno.test("parseSprintMetrics - 正常系: 全PBIが一致するスプリントを集計", () => {
  const result = parseSprintMetrics(MOCK_ARCHIVE, "Sprint 5");

  assertEquals(result.sprintName, "Sprint 5");
  assertEquals(result.pbiCount, 2);
  assertEquals(result.totalWeight, 5);
  assertEquals(result.matchRate, 1.0);
  assertEquals(result.mismatches.length, 0);
  assertStringIncludes(result.summary, "全一致");
});

/** 異常系: 見積XS・実感Sのように乖離したPBIを含むスプリントの集計を確認する */
Deno.test("parseSprintMetrics - 部分一致: 乖離PBIを含むスプリント", () => {
  const result = parseSprintMetrics(MOCK_ARCHIVE, "Sprint 4");

  assertEquals(result.pbiCount, 1);
  assertEquals(result.matchRate, 0);
  assertEquals(result.mismatches.length, 1);
  assertEquals(result.mismatches[0].id, "[OtherSprint]/Feature-Z");
  assertEquals(result.mismatches[0].estimated, "XS");
  assertEquals(result.mismatches[0].actual, "S");
  assertStringIncludes(result.summary, "XS");
  assertStringIncludes(result.summary, "S");
});

/** エッジケース: 存在しないスプリント名を渡した場合にエラーにならず空のメトリクスを返すことを確認する */
Deno.test("parseSprintMetrics - エッジケース: 該当PBIが0件", () => {
  const result = parseSprintMetrics(MOCK_ARCHIVE, "Sprint 99");

  assertEquals(result.sprintName, "Sprint 99");
  assertEquals(result.pbiCount, 0);
  assertEquals(result.totalWeight, 0);
  assertEquals(result.matchRate, 1.0);
  assertEquals(result.mismatches.length, 0);
});

Deno.test("buildTableRow - 正常系: 正しいテーブル行を生成", () => {
  const metrics: SprintMetrics = {
    sprintName: "Sprint 5",
    pbiCount: 2,
    totalWeight: 5,
    matchRate: 1.0,
    mismatches: [],
    summary: "全一致",
  };

  const row = buildTableRow(metrics);
  assertStringIncludes(row, "Sprint 5");
  assertStringIncludes(row, "2");
  assertStringIncludes(row, "5");
  assertStringIncludes(row, "全一致");
});

Deno.test("buildTableRow - エッジケース: 乖離ありの行を生成", () => {
  const metrics: SprintMetrics = {
    sprintName: "Sprint 4",
    pbiCount: 1,
    totalWeight: 1,
    matchRate: 0,
    mismatches: [{ id: "[OtherSprint]/Feature-Z", estimated: "XS", actual: "S" }],
    summary: "Feature-Z が XS→S に乖離",
  };

  const row = buildTableRow(metrics);
  assertStringIncludes(row, "Sprint 4");
  assertStringIncludes(row, "1");
  assertStringIncludes(row, "XS→S");
});

Deno.test("updateBacklogFile - dry-run時は元の内容を変更しない", () => {
  const newRow = "| Sprint 5 | 2 | 5 | 全一致 | 初の自動集計 |";
  const result = updateBacklogFile(MOCK_BACKLOG_HEADER, newRow, true);

  assertEquals(result, MOCK_BACKLOG_HEADER);
});

Deno.test("updateBacklogFile - 通常時はテーブルに行を追記", () => {
  const newRow = "| Sprint 5 | 2 | 5 | 全一致 | 初の自動集計 |";
  const result = updateBacklogFile(MOCK_BACKLOG_HEADER, newRow, false);

  assertStringIncludes(result, "Sprint 5");
  assertStringIncludes(result, "初の自動集計");
  assertStringIncludes(result, "Sprint 4");
});

Deno.test("updateBacklogFile - エッジケース: 空行を追記してもエラーにならない", () => {
  const result = updateBacklogFile(MOCK_BACKLOG_HEADER, "", false);
  assertEquals(typeof result, "string");
});
