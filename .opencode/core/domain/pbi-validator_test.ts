import { assertEquals } from "@std/assert";
import { pbiValidator } from "./pbi-validator.ts";
import type { EntityState, ProductBacklogItemData, Stage } from "./types.ts";
import { VALID } from "./entity-validator.ts";

const scope = { owner: "my-org", repository: "my-repo" };

/**
 * ProductBacklogItemData のテスト用ファクトリ。
 * 指定された overrides で一部フィールドを上書き可能。
 */
function makePbiData(overrides?: Partial<ProductBacklogItemData>): ProductBacklogItemData {
  return {
    identifier: {
      scope,
      title: { value: "Test PBI" },
      id: "pbi-1",
      describe() {
        return { summary: "describe", steps: [] };
      },
    },
    statement: { summary: "Test summary" },
    stage: "idea",
    state: "open",
    ...overrides,
  };
}

interface TestCase {
  name: string;
  operation: string;
  from: ProductBacklogItemData;
  to: ProductBacklogItemData;
  expected: { valid: boolean };
}

/**
 * テストケースの配列をテーブル駆動で実行する。
 * 各ケースは pbiValidator.validate() を呼び出し、valid フラグが期待値と一致することを確認する。
 */
function runTests(label: string, cases: TestCase[]) {
  for (const tc of cases) {
    Deno.test(`${label}: ${tc.name}`, () => {
      const result = pbiValidator.validate(tc.operation, tc.from, tc.to);
      assertEquals(result.valid, tc.expected.valid, JSON.stringify(result.errors));
    });
  }
}

/** Stage と State のみ指定して簡易 PBI データを生成する。 */
function makePbi(stage: Stage, state: EntityState): ProductBacklogItemData {
  return makePbiData({ stage, state });
}

// =================================================================
// AC-2: 状態遷移ルール — TRANSITIONSテーブルと一致する遷移のみ許可
// 検証意図: commit/start/complete/archive の4操作が正しい
// stage/state 遷移でのみ VALID を返すことを確認する
// =================================================================

/** アーカイブ可能なPBIデータ（プロセス分析完了済み）。 */
function makeArchivablePbi(): ProductBacklogItemData {
  return makePbiData({
    stage: "done",
    state: "open",
    processEvidence: { sizeVariance: { estimate: undefined } },
  });
}

/** 許容される4つの状態遷移パターン */
const VALID_TRANSITIONS: TestCase[] = [
  {
    name: "commit: (idea,open)→(todo,open)",
    operation: "commit",
    from: makePbi("idea", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: true },
  },
  {
    name: "start: (todo,open)→(inProgress,open)",
    operation: "start",
    from: makePbi("todo", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: true },
  },
  {
    name: "complete: (inProgress,open)→(done,open)",
    operation: "complete",
    from: makePbi("inProgress", "open"),
    to: makePbi("done", "open"),
    expected: { valid: true },
  },
  {
    name: "archive: (done,open)→(done,closed) プロセス分析完了済み",
    operation: "archive",
    from: makeArchivablePbi(),
    to: makePbi("done", "closed"),
    expected: { valid: true },
  },
];

/** TRANSITIONSテーブルに定義されていない不正な遷移パターン */
const INVALID_TRANSITIONS: TestCase[] = [
  {
    name: "start from idea",
    operation: "start",
    from: makePbi("idea", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "complete from idea",
    operation: "complete",
    from: makePbi("idea", "open"),
    to: makePbi("done", "open"),
    expected: { valid: false },
  },
  {
    name: "commit from todo",
    operation: "commit",
    from: makePbi("todo", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "commit from inProgress",
    operation: "commit",
    from: makePbi("inProgress", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "start from done",
    operation: "start",
    from: makePbi("done", "open"),
    to: makePbi("done", "open"),
    expected: { valid: false },
  },
  {
    name: "archive from idea",
    operation: "archive",
    from: makePbi("idea", "open"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
  {
    name: "archive from inProgress",
    operation: "archive",
    from: makePbi("inProgress", "open"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
];

runTests("正常遷移", VALID_TRANSITIONS);
runTests("禁止遷移", INVALID_TRANSITIONS);

// =================================================================
// AC-3: 値の制約ルール
// 検証意図: estimateSize/confirmSize/recordAnalysis/revise/
// defineAcceptanceCriteria の各操作が、PBIのstage/stateに応じて
// 正しく許可/禁止されることを確認する
// =================================================================

// ----- estimateSize: stage=inProgress/done または state=closed で禁止 -----
runTests("estimateSize - 許可", [
  {
    name: "(idea,open) は許可",
    operation: "estimateSize",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(todo,open) は許可",
    operation: "estimateSize",
    from: makePbi("todo", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: true },
  },
]);

runTests("estimateSize - 禁止", [
  {
    name: "(inProgress,open) は禁止",
    operation: "estimateSize",
    from: makePbi("inProgress", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,open) は禁止",
    operation: "estimateSize",
    from: makePbi("done", "open"),
    to: makePbi("done", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "estimateSize",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
  {
    name: "(idea,closed) は禁止",
    operation: "estimateSize",
    from: makePbi("idea", "closed"),
    to: makePbi("idea", "closed"),
    expected: { valid: false },
  },
]);

// ----- confirmSize: (done,open) のみ許可 -----
runTests("confirmSize - 許可", [
  {
    name: "(done,open) は許可",
    operation: "confirmSize",
    from: makePbi("done", "open"),
    to: makePbi("done", "open"),
    expected: { valid: true },
  },
]);

runTests("confirmSize - 禁止", [
  {
    name: "(idea,open) は禁止",
    operation: "confirmSize",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: false },
  },
  {
    name: "(todo,open) は禁止",
    operation: "confirmSize",
    from: makePbi("todo", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "(inProgress,open) は禁止",
    operation: "confirmSize",
    from: makePbi("inProgress", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "confirmSize",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
]);

// ----- recordAnalysis: (done,open) のみ許可 -----
runTests("recordAnalysis - 許可", [
  {
    name: "(done,open) は許可",
    operation: "recordAnalysis",
    from: makePbi("done", "open"),
    to: makePbi("done", "open"),
    expected: { valid: true },
  },
]);

runTests("recordAnalysis - 禁止", [
  {
    name: "(idea,open) は禁止",
    operation: "recordAnalysis",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: false },
  },
  {
    name: "(todo,open) は禁止",
    operation: "recordAnalysis",
    from: makePbi("todo", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: false },
  },
  {
    name: "(inProgress,open) は禁止",
    operation: "recordAnalysis",
    from: makePbi("inProgress", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "recordAnalysis",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
]);

// ----- revise: stage=done または state=closed で禁止 -----
runTests("revise - 許可", [
  {
    name: "(idea,open) は許可",
    operation: "revise",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(todo,open) は許可",
    operation: "revise",
    from: makePbi("todo", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: true },
  },
  {
    name: "(inProgress,open) は許可",
    operation: "revise",
    from: makePbi("inProgress", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: true },
  },
]);

runTests("revise - 禁止", [
  {
    name: "(done,open) は禁止",
    operation: "revise",
    from: makePbi("done", "open"),
    to: makePbi("done", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "revise",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
  {
    name: "(idea,closed) は禁止",
    operation: "revise",
    from: makePbi("idea", "closed"),
    to: makePbi("idea", "closed"),
    expected: { valid: false },
  },
]);

// ----- defineAcceptanceCriteria: stage=done または state=closed で禁止 -----
runTests("defineAcceptanceCriteria - 許可", [
  {
    name: "(idea,open) は許可",
    operation: "defineAcceptanceCriteria",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(todo,open) は許可",
    operation: "defineAcceptanceCriteria",
    from: makePbi("todo", "open"),
    to: makePbi("todo", "open"),
    expected: { valid: true },
  },
  {
    name: "(inProgress,open) は許可",
    operation: "defineAcceptanceCriteria",
    from: makePbi("inProgress", "open"),
    to: makePbi("inProgress", "open"),
    expected: { valid: true },
  },
]);

runTests("defineAcceptanceCriteria - 禁止", [
  {
    name: "(done,open) は禁止",
    operation: "defineAcceptanceCriteria",
    from: makePbi("done", "open"),
    to: makePbi("done", "open"),
    expected: { valid: false },
  },
  {
    name: "(done,closed) は禁止",
    operation: "defineAcceptanceCriteria",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: false },
  },
]);

// ----- assignToFeature / unassignFromFeature: 常に許可（分類変更のため） -----
runTests("assignToFeature", [
  {
    name: "(idea,open) は許可",
    operation: "assignToFeature",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(done,closed) でも許可",
    operation: "assignToFeature",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: true },
  },
]);

runTests("unassignFromFeature", [
  {
    name: "(idea,open) は許可",
    operation: "unassignFromFeature",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
  {
    name: "(done,closed) でも許可",
    operation: "unassignFromFeature",
    from: makePbi("done", "closed"),
    to: makePbi("done", "closed"),
    expected: { valid: true },
  },
]);

// ----- propose / find / search: 常に許可（新規作成・読み取り専用） -----
runTests("propose", [
  {
    name: "常に許可",
    operation: "propose",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
]);

runTests("find", [
  {
    name: "常に許可",
    operation: "find",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
]);

runTests("search", [
  {
    name: "常に許可",
    operation: "search",
    from: makePbi("idea", "open"),
    to: makePbi("idea", "open"),
    expected: { valid: true },
  },
]);

// ----- 未知のoperation: フォールバックとしてVALIDを返す -----
Deno.test("未知のoperation は VALID を返す", () => {
  const result = pbiValidator.validate(
    "unknownOp",
    makePbi("idea", "open"),
    makePbi("idea", "open"),
  );
  assertEquals(result, VALID);
});

// ----- AC-5: エラーメッセージが日本語であること -----
Deno.test("エラーメッセージが日本語であること", () => {
  const result = pbiValidator.validate(
    "estimateSize",
    makePbi("inProgress", "open"),
    makePbi("inProgress", "open"),
  );
  assertEquals(result.valid, false);
  if (result.errors.length > 0) {
    const containsJapanese = /[一-龠ぁ-ゔァ-ヴーａ-ｚＡ-Ｚ０-９]/.test(result.errors[0]);
    assertEquals(
      containsJapanese,
      true,
      `エラーメッセージが日本語ではありません: ${result.errors[0]}`,
    );
  }
});

// =================================================================
// アーカイブのエッジケース
// 検証意図: archive はプロセス分析（processEvidence）の記録が完了した
// PBIのみ許可される。スプリント終了時には全完了PBIの分析を記録してから
// アーカイブする運用フローを強制する。
// =================================================================

Deno.test("archive: processEvidence あり → 許可", () => {
  const result = pbiValidator.validate(
    "archive",
    makeArchivablePbi(),
    makePbi("done", "closed"),
  );
  assertEquals(result.valid, true);
});

Deno.test("archive: processEvidence なし → 禁止", () => {
  const result = pbiValidator.validate(
    "archive",
    makePbi("done", "open"),
    makePbi("done", "closed"),
  );
  assertEquals(result.valid, false);
  assertEquals(
    result.errors[0].includes("プロセス分析"),
    true,
    `エラーメッセージに「プロセス分析」が含まれていません: ${result.errors[0]}`,
  );
});
