import { assertEquals } from "@std/assert";
import { wpValidator } from "./wp-validator.ts";
import type { EntityState, Stage, WorkPackageData } from "./types.ts";
import { VALID } from "./entity-validator.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makeWpData(overrides?: Partial<WorkPackageData>): WorkPackageData {
  return {
    identifier: {
      scope,
      title: { value: "Test WP" },
      id: "wp-1",
      describe() {
        return { summary: "describe", steps: [] };
      },
    },
    statement: {
      acceptanceCriteria: {
        items: [{ number: "1", description: "Test AC", judgment: "unchecked" }],
      },
    },
    parentPbi: {
      scope,
      title: { value: "Parent PBI" },
      id: "pbi-1",
      describe() {
        return { summary: "describe", steps: [] };
      },
    },
    stage: "idea",
    state: "open",
    ...overrides,
  };
}

interface TestCase {
  name: string;
  operation: string;
  from: WorkPackageData;
  to: WorkPackageData;
  expected: { valid: boolean };
}

function runTests(label: string, cases: TestCase[]) {
  for (const tc of cases) {
    Deno.test(`${label}: ${tc.name}`, () => {
      const result = wpValidator.validate(tc.operation, tc.from, tc.to);
      assertEquals(result.valid, tc.expected.valid, JSON.stringify(result.errors));
    });
  }
}

function makeWp(stage: Stage, state: EntityState): WorkPackageData {
  return makeWpData({ stage, state });
}

function makeArchivableWp(): WorkPackageData {
  return makeWpData({
    stage: "done",
    state: "open",
    processEvidence: { effort: { initialEstimate: 1 } },
  });
}

function makeProcessEvidenceCompleteWp(): WorkPackageData {
  return makeWpData({
    stage: "done",
    state: "open",
    processEvidence: {
      effort: { initialEstimate: 3, plannedEstimate: 5, actual: 5 },
      processAnalysis: {
        planningReview: "Good",
        executionReview: "Smooth",
        improvementSuggestions: "None",
      },
    },
  });
}

// =================================================================
// 状態遷移ルール
// =================================================================

const VALID_TRANSITIONS: TestCase[] = [
  {
    name: "commit: (idea,open)→(todo,open)",
    operation: "commit",
    from: makeWp("idea", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: true },
  },
  {
    name: "start: (todo,open)→(inProgress,open)",
    operation: "start",
    from: makeWp("todo", "open"),
    to: makeWp("inProgress", "open"),
    expected: { valid: true },
  },
  {
    name: "complete: (inProgress,open)→(done,open)",
    operation: "complete",
    from: makeWp("inProgress", "open"),
    to: makeWp("done", "open"),
    expected: { valid: true },
  },
  {
    name: "archive: (done,open)→(done,closed)",
    operation: "archive",
    from: makeArchivableWp(),
    to: makeWp("done", "closed"),
    expected: { valid: true },
  },
];

const INVALID_TRANSITIONS: TestCase[] = [
  {
    name: "start from idea",
    operation: "start",
    from: makeWp("idea", "open"),
    to: makeWp("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "complete from idea",
    operation: "complete",
    from: makeWp("idea", "open"),
    to: makeWp("done", "open"),
    expected: { valid: false },
  },
  {
    name: "commit from todo",
    operation: "commit",
    from: makeWp("todo", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "commit from inProgress",
    operation: "commit",
    from: makeWp("inProgress", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "start from done",
    operation: "start",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: false },
  },
  {
    name: "archive from idea",
    operation: "archive",
    from: makeWp("idea", "open"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
  {
    name: "archive from inProgress",
    operation: "archive",
    from: makeWp("inProgress", "open"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
];

runTests("正常遷移", VALID_TRANSITIONS);
runTests("禁止遷移", INVALID_TRANSITIONS);

// =================================================================
// revise: stage=done または state=closed で禁止
// =================================================================

runTests("revise - 許可", [
  {
    name: "(idea,open) は許可",
    operation: "revise",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(todo,open) は許可",
    operation: "revise",
    from: makeWp("todo", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: true },
  },
  {
    name: "(inProgress,open) は許可",
    operation: "revise",
    from: makeWp("inProgress", "open"),
    to: makeWp("inProgress", "open"),
    expected: { valid: true },
  },
]);

runTests("revise - 禁止", [
  {
    name: "(done,open) は禁止",
    operation: "revise",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "revise",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
  {
    name: "(idea,closed) は禁止",
    operation: "revise",
    from: makeWp("idea", "closed"),
    to: makeWp("idea", "closed"),
    expected: { valid: false },
  },
]);

// =================================================================
// estimateInitialEffort: stage∈{idea,todo} かつ state=open
// =================================================================

runTests("estimateInitialEffort - 許可", [
  {
    name: "(idea,open) は許可",
    operation: "estimateInitialEffort",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(todo,open) は許可",
    operation: "estimateInitialEffort",
    from: makeWp("todo", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: true },
  },
]);

runTests("estimateInitialEffort - 禁止", [
  {
    name: "(inProgress,open) は禁止",
    operation: "estimateInitialEffort",
    from: makeWp("inProgress", "open"),
    to: makeWp("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,open) は禁止",
    operation: "estimateInitialEffort",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "estimateInitialEffort",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
]);

// =================================================================
// estimatePlannedEffort: (inProgress,open) のみ（planned と initial の大小は問わない）
// =================================================================

runTests("estimatePlannedEffort - 許可", [
  {
    name: "(inProgress,open) planned>=initial は許可",
    operation: "estimatePlannedEffort",
    from: makeWpData({
      stage: "inProgress",
      state: "open",
      processEvidence: { effort: { initialEstimate: 3 } },
    }),
    to: makeWpData({
      stage: "inProgress",
      state: "open",
      processEvidence: { effort: { initialEstimate: 3, plannedEstimate: 5 } },
    }),
    expected: { valid: true },
  },
  {
    name: "(inProgress,open) planned=initial は許可",
    operation: "estimatePlannedEffort",
    from: makeWpData({
      stage: "inProgress",
      state: "open",
      processEvidence: { effort: { initialEstimate: 3 } },
    }),
    to: makeWpData({
      stage: "inProgress",
      state: "open",
      processEvidence: { effort: { initialEstimate: 3, plannedEstimate: 3 } },
    }),
    expected: { valid: true },
  },
  {
    name: "(inProgress,open) planned<initial は許可（下方修正許容・backlog-guidelines 2.2.1）",
    operation: "estimatePlannedEffort",
    from: makeWpData({
      stage: "inProgress",
      state: "open",
      processEvidence: { effort: { initialEstimate: 5 } },
    }),
    to: makeWpData({
      stage: "inProgress",
      state: "open",
      processEvidence: { effort: { initialEstimate: 5, plannedEstimate: 3 } },
    }),
    expected: { valid: true },
  },
]);

runTests("estimatePlannedEffort - 禁止", [
  {
    name: "(idea,open) は禁止",
    operation: "estimatePlannedEffort",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,open) は禁止",
    operation: "estimatePlannedEffort",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: false },
  },
]);

// =================================================================
// recordActualEffort: (done,open) のみ許可
// =================================================================

runTests("recordActualEffort - 許可", [
  {
    name: "(done,open) は許可",
    operation: "recordActualEffort",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: true },
  },
]);

runTests("recordActualEffort - 禁止", [
  {
    name: "(idea,open) は禁止",
    operation: "recordActualEffort",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: false },
  },
  {
    name: "(todo,open) は禁止",
    operation: "recordActualEffort",
    from: makeWp("todo", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "(inProgress,open) は禁止",
    operation: "recordActualEffort",
    from: makeWp("inProgress", "open"),
    to: makeWp("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "recordActualEffort",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
]);

// =================================================================
// recordAnalysis: (done,open) のみ許可
// =================================================================

runTests("recordAnalysis - 許可", [
  {
    name: "(done,open) は許可",
    operation: "recordAnalysis",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: true },
  },
]);

runTests("recordAnalysis - 禁止", [
  {
    name: "(idea,open) は禁止",
    operation: "recordAnalysis",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: false },
  },
  {
    name: "(todo,open) は禁止",
    operation: "recordAnalysis",
    from: makeWp("todo", "open"),
    to: makeWp("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "(inProgress,open) は禁止",
    operation: "recordAnalysis",
    from: makeWp("inProgress", "open"),
    to: makeWp("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "recordAnalysis",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
]);

// =================================================================
// recordSessionMetrics: (done,open) + processEvidence全項目必須
// =================================================================

runTests("recordSessionMetrics - 許可", [
  {
    name: "processEvidence全項目あり → 許可",
    operation: "recordSessionMetrics",
    from: makeProcessEvidenceCompleteWp(),
    to: makeProcessEvidenceCompleteWp(),
    expected: { valid: true },
  },
]);

runTests("recordSessionMetrics - 禁止", [
  {
    name: "(idea,open) は禁止",
    operation: "recordSessionMetrics",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,open) processEvidenceなし → 禁止",
    operation: "recordSessionMetrics",
    from: makeWp("done", "open"),
    to: makeWp("done", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "recordSessionMetrics",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: false },
  },
]);

// =================================================================
// define / assignToProductBacklogItem / unassignFromProductBacklogItem / find / search: 常に許可
// =================================================================

runTests("define", [
  {
    name: "常に許可",
    operation: "define",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
]);

runTests("assignToProductBacklogItem", [
  {
    name: "(idea,open) は許可",
    operation: "assignToProductBacklogItem",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(done,closed) でも許可",
    operation: "assignToProductBacklogItem",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: true },
  },
]);

runTests("unassignFromProductBacklogItem", [
  {
    name: "(idea,open) は許可",
    operation: "unassignFromProductBacklogItem",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(done,closed) でも許可",
    operation: "unassignFromProductBacklogItem",
    from: makeWp("done", "closed"),
    to: makeWp("done", "closed"),
    expected: { valid: true },
  },
]);

runTests("find", [
  {
    name: "常に許可",
    operation: "find",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
]);

runTests("search", [
  {
    name: "常に許可",
    operation: "search",
    from: makeWp("idea", "open"),
    to: makeWp("idea", "open"),
    expected: { valid: true },
  },
]);

// =================================================================
// 未知のoperation: フォールバック
// =================================================================

Deno.test("未知のoperation は VALID を返す", () => {
  const result = wpValidator.validate("unknownOp", makeWp("idea", "open"), makeWp("idea", "open"));
  assertEquals(result, VALID);
});

// =================================================================
// アーカイブのエッジケース
// =================================================================

Deno.test("archive: processEvidence あり → 許可", () => {
  const result = wpValidator.validate("archive", makeArchivableWp(), makeWp("done", "closed"));
  assertEquals(result.valid, true);
});

Deno.test("archive: processEvidence なし → 禁止", () => {
  const result = wpValidator.validate("archive", makeWp("done", "open"), makeWp("done", "closed"));
  assertEquals(result.valid, false);
  assertEquals(
    result.errors[0].includes("プロセス分析"),
    true,
    `エラーメッセージに「プロセス分析」が含まれていません: ${result.errors[0]}`,
  );
});
