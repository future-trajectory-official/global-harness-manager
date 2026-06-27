import { assertEquals, assertThrows } from "@std/assert";
import type {
  ChangeReason,
  FeatureIdentifier,
  ProcessAnalysis,
  ProductBacklogItemIdentifier,
  ProductBacklogItemSearchCondition,
  ProductBacklogItemStatement,
  SizeVariance,
  SprintIdentifier,
  WorkPackageData,
} from "./types.ts";
import { productBacklogItemUseCase } from "./product-backlog-item-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makePbiId(
  overrides?: Partial<ProductBacklogItemIdentifier>,
): ProductBacklogItemIdentifier {
  return {
    scope,
    title: { value: "User Authentication" },
    id: "pbi-1",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeStatement(summary = "Implement user login"): ProductBacklogItemStatement {
  return { summary };
}

function makeReason(description = "Scope change"): ChangeReason {
  return { description };
}

function makeSprintId(overrides?: Partial<SprintIdentifier>): SprintIdentifier {
  return {
    scope,
    title: { value: "Sprint 15" },
    id: "sprint-15",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeFeatureId(overrides?: Partial<FeatureIdentifier>): FeatureIdentifier {
  return {
    scope,
    title: { value: "Authentication" },
    id: "feature-1",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeSizeVariance(): SizeVariance {
  return { estimate: undefined, actual: undefined };
}

function makeProcessAnalysis(): ProcessAnalysis {
  return {
    planningReview: "Good planning",
    executionReview: "Smooth execution",
    improvementSuggestions: "Add more tests",
  };
}

function makeWorkPackageData(): WorkPackageData[] {
  return [{
    identifier: {
      scope,
      title: { value: "WP-1" },
      id: "wp-1",
      describe() {
        return { summary: "describe", steps: [] };
      },
    },
    statement: {
      acceptanceCriteria: {
        items: [{ number: "1", description: "Login works", judgment: "unchecked" }],
      },
    },
    parentPbi: {
      scope,
      title: { value: "User Authentication" },
      id: "pbi-1",
      describe() {
        return { summary: "describe", steps: [] };
      },
    },
    stage: "idea",
    state: "open",
  }];
}

function makeSearchCondition(): ProductBacklogItemSearchCondition {
  return {
    keyword: "login",
    describe() {
      return {
        summary: "Search PBIs with keyword: login",
        steps: [{ operation: "searchItems", params: { type: "PBI", keyword: "login" } }],
      };
    },
  };
}

// ===== propose =====

/**
 * propose の正常系。id が undefined の場合に createItem 操作を含む Plan が返ることを確認する。
 * @description PBI発案時に正しい Plan（createItem）が生成されること
 * @verify Plan.summary と Plan.steps[0].operation/params が期待値と一致すること
 */
Deno.test("propose should return Plan with createItem operation", () => {
  const plan = productBacklogItemUseCase.propose(makePbiId({ id: undefined }), makeStatement());
  assertEquals(plan.summary, "Propose PBI: User Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "createItem");
  assertEquals(plan.steps[0].params.title, "User Authentication");
  assertEquals(plan.steps[0].params.type, "PBI");
});

/**
 * propose の異常系。空タイトルで Error がスローされることを確認する。
 * @description 空の title が与えられた場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("propose should throw for empty title", () => {
  assertThrows(
    () =>
      productBacklogItemUseCase.propose(
        makePbiId({ title: { value: "" }, id: undefined }),
        makeStatement(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * propose の異常系。空サマリーで Error がスローされることを確認する。
 * @description 空の statement が与えられた場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("propose should throw for empty summary", () => {
  assertThrows(
    () => productBacklogItemUseCase.propose(makePbiId({ id: undefined }), makeStatement("")),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * propose の正常系。parentFeature 指定時にその id が Plan パラメータに含まれることを確認する。
 * @description parentFeature を指定した場合に Plan.steps[0].params.parentFeature が設定されること
 * @verify parentFeature の id が params.parentFeature と一致すること
 */
Deno.test("propose with parentFeature should include parent feature id", () => {
  const feature = makeFeatureId();
  const plan = productBacklogItemUseCase.propose(
    makePbiId({ id: undefined }),
    makeStatement(),
    feature,
  );
  assertEquals(plan.steps[0].params.parentFeature, "feature-1");
});

/**
 * propose の異常系。parentFeature の id が undefined の場合にエラーがスローされることを確認する。
 * @description 不完全な FeatureIdentifier（id なし）を渡した場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("propose should throw for parentFeature with undefined id", () => {
  const feature = makeFeatureId({ id: undefined });
  assertThrows(
    () => productBacklogItemUseCase.propose(makePbiId({ id: undefined }), makeStatement(), feature),
    Error,
    "INVALID_INPUT",
  );
});

// ===== revise =====

/**
 * revise の正常系。updateItem と editComment の2ステップからなる Plan が返ることを確認する。
 * @description PBI修正時に正しい Plan（updateItem + editComment）が生成されること
 * @verify Plan.summary、steps の長さ、各 step の operation が期待値と一致すること
 */
Deno.test("revise should return Plan with updateItem + editComment", () => {
  const plan = productBacklogItemUseCase.revise(makePbiId(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Revise PBI: User Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[0].params.type, "PBI");
  assertEquals(plan.steps[1].operation, "editComment");
});

/**
 * revise の異常系。id が undefined の場合にエラーがスローされることを確認する。
 * @description 不完全な PBI（id なし）の修正で INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("revise should throw for undefined id", () => {
  assertThrows(
    () =>
      productBacklogItemUseCase.revise(makePbiId({ id: undefined }), makeStatement(), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * revise の異常系。空の reason でエラーがスローされることを確認する。
 * @description 空の ChangeReason が与えられた場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("revise should throw for empty reason", () => {
  assertThrows(
    () => productBacklogItemUseCase.revise(makePbiId(), makeStatement(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

// ===== commit =====

/**
 * commit の正常系。updateItem（sprint 設定）と editComment の Plan が返ることを確認する。
 * @description PBIのスプリントコミット時に正しい Plan（updateItem + editComment）が生成されること
 * @verify Plan.summary、steps の長さ、各 step の operation/params が期待値と一致すること
 */
Deno.test("commit should return Plan with updateItem + editComment", () => {
  const plan = productBacklogItemUseCase.commit(makePbiId(), makeSprintId());
  assertEquals(plan.summary, "Commit PBI User Authentication to Sprint 15");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[0].params.sprint, "Sprint 15");
  assertEquals(plan.steps[1].operation, "editComment");
});

/**
 * commit の異常系。id が undefined の場合にエラーがスローされることを確認する。
 * @description 不完全な PBI（id なし）のコミットで INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("commit should throw for undefined id", () => {
  assertThrows(
    () => productBacklogItemUseCase.commit(makePbiId({ id: undefined }), makeSprintId()),
    Error,
    "INVALID_INPUT",
  );
});

// ===== start =====

/**
 * start の正常系。updateItem（開始状態への変更）と editComment の Plan が返ることを確認する。
 * @description PBIの開始時に正しい Plan（updateItem + editComment）が生成されること
 * @verify Plan.summary、steps の長さ、各 step の operation が期待値と一致すること
 */
Deno.test("start should return Plan with updateItem + editComment", () => {
  const plan = productBacklogItemUseCase.start(makePbiId());
  assertEquals(plan.summary, "Start PBI: User Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[1].operation, "editComment");
});

/**
 * start の異常系。id が undefined の場合にエラーがスローされることを確認する。
 * @description 不完全な PBI（id なし）の開始で INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("start should throw for undefined id", () => {
  assertThrows(
    () => productBacklogItemUseCase.start(makePbiId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== complete =====

/**
 * complete の正常系。updateItem（完了状態への変更）と editComment の Plan が返ることを確認する。
 * @description PBIの完了時に正しい Plan（updateItem + editComment）が生成されること
 * @verify Plan.summary、steps の長さ、各 step の operation が期待値と一致すること
 */
Deno.test("complete should return Plan with updateItem + editComment", () => {
  const plan = productBacklogItemUseCase.complete(makePbiId());
  assertEquals(plan.summary, "Complete PBI: User Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[1].operation, "editComment");
});

// ===== archive =====

/**
 * archive の正常系。closeItem（クローズ）と editComment の Plan が返ることを確認する。
 * @description PBIのアーカイブ時に正しい Plan（closeItem + editComment）が生成されること
 * @verify Plan.summary、steps の長さ、各 step の operation が期待値と一致すること
 */
Deno.test("archive should return Plan with closeItem + editComment", () => {
  const plan = productBacklogItemUseCase.archive(makePbiId());
  assertEquals(plan.summary, "Archive PBI: User Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "closeItem");
  assertEquals(plan.steps[1].operation, "editComment");
});

// ===== defineAcceptanceCriteria =====

/**
 * defineAcceptanceCriteria の正常系。WP ごとに createItem 操作を含む Plan が返ることを確認する。
 * @description 受入基準定義時に正しい Plan（createItem per WP）が生成されること
 * @verify Plan.steps の長さ、operation/params.type が期待値と一致すること
 */
Deno.test("defineAcceptanceCriteria should return Plan with createItem per WP", () => {
  const wps = makeWorkPackageData();
  const plan = productBacklogItemUseCase.defineAcceptanceCriteria(makePbiId(), wps);
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "createItem");
  assertEquals(plan.steps[0].params.type, "WP");
});

/**
 * defineAcceptanceCriteria の異常系。空の WP リストでエラーがスローされることを確認する。
 * @description 空の WorkPackage リストが与えられた場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("defineAcceptanceCriteria should throw for empty WP list", () => {
  assertThrows(
    () => productBacklogItemUseCase.defineAcceptanceCriteria(makePbiId(), []),
    Error,
    "INVALID_INPUT",
  );
});

// ===== assignToFeature =====

/**
 * assignToFeature の正常系。updateItem（Feature 紐付け）を含む Plan が返ることを確認する。
 * @description PBI への Feature 割り当て時に正しい Plan（updateItem）が生成されること
 * @verify Plan.summary、steps の長さ、params.parentFeature が期待値と一致すること
 */
Deno.test("assignToFeature should return Plan with updateItem", () => {
  const plan = productBacklogItemUseCase.assignToFeature(makePbiId(), makeFeatureId());
  assertEquals(plan.summary, "Assign PBI User Authentication to feature Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[0].params.parentFeature, "feature-1");
});

// ===== unassignFromFeature =====

/**
 * unassignFromFeature の正常系。updateItem（Feature 解除）を含む Plan が返ることを確認する。
 * @description PBI からの Feature 割り当て解除時に正しい Plan（updateItem）が生成されること
 * @verify Plan.summary と steps の長さ、operation が期待値と一致すること
 */
Deno.test("unassignFromFeature should return Plan with updateItem", () => {
  const plan = productBacklogItemUseCase.unassignFromFeature(makePbiId());
  assertEquals(plan.summary, "Unassign PBI User Authentication from feature");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "updateItem");
});

// ===== estimateSize =====

/**
 * estimateSize の正常系。updateItem（見積もり設定）を含む Plan が返ることを確認する。
 * @description PBI のサイズ見積もり時に正しい Plan（updateItem）が生成されること
 * @verify Plan.summary、steps の長さ、operation が期待値と一致すること
 */
Deno.test("estimateSize should return Plan with updateItem", () => {
  const plan = productBacklogItemUseCase.estimateSize(makePbiId(), makeSizeVariance());
  assertEquals(plan.summary, "Estimate size for PBI: User Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "updateItem");
});

// ===== confirmSize =====

/**
 * confirmSize の正常系。updateItem（サイズ確定）を含む Plan が返ることを確認する。
 * @description PBI のサイズ確定時に正しい Plan（updateItem）が生成されること
 * @verify Plan.summary、steps の長さ、operation が期待値と一致すること
 */
Deno.test("confirmSize should return Plan with updateItem", () => {
  const plan = productBacklogItemUseCase.confirmSize(makePbiId(), makeSizeVariance());
  assertEquals(plan.summary, "Confirm size for PBI: User Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "updateItem");
});

// ===== recordAnalysis =====

/**
 * recordAnalysis の正常系。editComment（分析結果コメント）を含む Plan が返ることを確認する。
 * @description PBI のプロセス分析記録時に正しい Plan（editComment）が生成されること
 * @verify Plan.summary、steps の長さ、operation が期待値と一致すること
 */
Deno.test("recordAnalysis should return Plan with editComment", () => {
  const plan = productBacklogItemUseCase.recordAnalysis(makePbiId(), makeProcessAnalysis());
  assertEquals(plan.summary, "Record analysis for PBI: User Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "editComment");
});

/**
 * recordAnalysis の異常系。空の planningReview でエラーがスローされることを確認する。
 * @description 空の planningReview が与えられた場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("recordAnalysis should throw for empty planningReview", () => {
  assertThrows(
    () =>
      productBacklogItemUseCase.recordAnalysis(
        makePbiId(),
        { planningReview: "", executionReview: "ok", improvementSuggestions: "ok" },
      ),
    Error,
    "INVALID_INPUT",
  );
});

// ===== find =====

/**
 * find の正常系。findItem 操作を含む Plan が返ることを確認する。
 * @description PBI 検索時に正しい Plan（findItem）が生成されること
 * @verify Plan.summary と steps[0].operation が期待値と一致すること
 */
Deno.test("find should return Plan with findItem step", () => {
  const plan = productBacklogItemUseCase.find(makePbiId());
  assertEquals(plan.summary, "Find PBI: User Authentication");
  assertEquals(plan.steps[0].operation, "findItem");
});

/**
 * find の異常系。id が undefined の場合にエラーがスローされることを確認する。
 * @description 不完全な PBI（id なし）の検索で INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("find should throw for undefined id", () => {
  assertThrows(
    () => productBacklogItemUseCase.find(makePbiId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== search =====

/**
 * search の正常系。searchItems 操作を含む Plan が返ることを確認する。
 * @description PBI のキーワード検索時に正しい Plan（searchItems）が生成されること
 * @verify steps[0].operation が "searchItems" と一致すること
 */
Deno.test("search should return Plan with searchItems step", () => {
  const condition = makeSearchCondition();
  const plan = productBacklogItemUseCase.search(condition);
  assertEquals(plan.steps[0].operation, "searchItems");
});
