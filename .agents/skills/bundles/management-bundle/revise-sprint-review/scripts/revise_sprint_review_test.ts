import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewPlanInput } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewIdentifier, SprintIdentifier } from "../../../../../core/domain/types.ts";
import {
  parseReviewBody,
  validateCommonInput,
  validateReviseInput,
} from "./revise_sprint_review.ts";

/**
 * テスト用の ReviewIdentifier を生成する。
 */
function makeIdentifier(overrides?: Partial<ReviewIdentifier>): ReviewIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 15 Review" },
    id: "review-1",
    code: "42",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

/**
 * 正常系: ReviewUseCase.revise が1つの revise Step を返すことを確認する。
 */
Deno.test("revise-sprint-review - revise should return Plan with revise step", () => {
  const removed = {
    items: [{ number: "1", description: "削除するAC", judgment: "removed" as const }],
  };
  const addedGroups = [{
    pbiNumber: 1,
    wpNumber: "2",
    acJudgments: [{ number: "3", description: "追加するAC", judgment: "unchecked" as const }],
  }];
  const plan = reviewUseCase.revise(
    makeIdentifier(),
    removed,
    undefined,
    { description: "仕様変更" },
    addedGroups,
  );

  assertEquals(plan.summary, "Revise review: Sprint 15 Review");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].entity, "Review");
  assertEquals(plan.steps[0].operation, "revise");
  assertEquals(plan.steps[0].params.itemId, "42");
});

/**
 * 正常系: removed と addedGroups が params に正しく含まれることを確認する。
 */
Deno.test("revise-sprint-review - revise params should include removed and addedGroups", () => {
  const removed = {
    items: [{ number: "1", description: "削除AC", judgment: "removed" as const }],
  };
  const addedGroups = [{
    pbiNumber: 1,
    wpNumber: "2",
    acJudgments: [{ number: "3", description: "追加AC", judgment: "unchecked" as const }],
  }];
  const plan = reviewUseCase.revise(
    makeIdentifier(),
    removed,
    undefined,
    { description: "変更理由" },
    addedGroups,
  );

  const params = plan.steps[0].params;
  assertEquals(params.removed, removed);
  assertEquals(params.addedGroups, addedGroups);
});

/**
 * 異常系: id が未設定の場合はエラーとなることを確認する。
 */
Deno.test("revise-sprint-review - revise should throw for undefined id", () => {
  assertThrows(
    () =>
      reviewUseCase.revise(
        makeIdentifier({ id: undefined }),
        undefined,
        undefined,
        { description: "理由" },
      ),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * 異常系: 空のレビュータイトルはエラーとなることを確認する。
 */
Deno.test("revise-sprint-review - revise should throw for empty title", () => {
  assertThrows(
    () =>
      reviewUseCase.revise(
        makeIdentifier({ title: { value: "" } }),
        undefined,
        undefined,
        { description: "理由" },
      ),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * 異常系: 空の変更理由はエラーとなることを確認する。
 */
Deno.test("revise-sprint-review - revise should throw for empty reason", () => {
  assertThrows(
    () => reviewUseCase.revise(makeIdentifier(), undefined, undefined, { description: "" }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * dry-run 出力に Plan 構造が含まれることを確認する。
 */
Deno.test("revise-sprint-review - dry-run output should contain Plan structure", () => {
  const plan = reviewUseCase.revise(
    makeIdentifier(),
    undefined,
    undefined,
    { description: "理由" },
  );
  const output = JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2);
  assertStringIncludes(output, "Revise review:");
  assertStringIncludes(output, "revise");
  assertStringIncludes(output, "Review");
});

/**
 * バリデーション: sprintNumber と code の両方が未指定の場合はエラーとなる。
 */
Deno.test("revise-sprint-review - validateCommonInput should throw when neither sprintNumber nor code is given", () => {
  assertThrows(
    () => validateCommonInput({ changeReason: "理由" }),
    Error,
    "either sprintNumber or code is required",
  );
});

/**
 * バリデーション: sprintNumber は正の整数である必要がある。
 */
Deno.test("revise-sprint-review - validateCommonInput should throw for invalid sprintNumber", () => {
  assertThrows(
    () => validateCommonInput({ sprintNumber: 0, changeReason: "理由" }),
    Error,
    "sprintNumber must be a positive integer",
  );
  assertThrows(
    () => validateCommonInput({ sprintNumber: -1, changeReason: "理由" }),
    Error,
    "sprintNumber must be a positive integer",
  );
  assertThrows(
    () => validateCommonInput({ sprintNumber: 1.5, changeReason: "理由" }),
    Error,
    "sprintNumber must be a positive integer",
  );
});

/**
 * バリデーション: code は文字列である必要がある。
 */
Deno.test("revise-sprint-review - validateCommonInput should throw for non-string code", () => {
  assertThrows(
    () => validateCommonInput({ code: 123 as unknown as string, changeReason: "理由" }),
    Error,
    "code must be a string",
  );
});

/**
 * バリデーション: 正常な入力はエラーとならない。
 */
Deno.test("revise-sprint-review - validateCommonInput should accept valid input", () => {
  validateCommonInput({ sprintNumber: 17, changeReason: "理由" });
  validateCommonInput({ code: "42", changeReason: "理由" });
});

/**
 * バリデーション: changeReason が未設定または空の場合はエラーとなる。
 */
Deno.test("revise-sprint-review - validateReviseInput should throw for missing or empty changeReason", () => {
  assertThrows(
    () => validateReviseInput({ sprintNumber: 17 }),
    Error,
    "changeReason is required",
  );
  assertThrows(
    () => validateReviseInput({ sprintNumber: 17, changeReason: "" }),
    Error,
    "changeReason must not be empty",
  );
  assertThrows(
    () => validateReviseInput({ sprintNumber: 17, changeReason: "   " }),
    Error,
    "changeReason must not be empty",
  );
});

/**
 * バリデーション: 正常な revise 入力はエラーとならない。
 */
Deno.test("revise-sprint-review - validateReviseInput should accept valid input", () => {
  validateReviseInput({
    sprintNumber: 17,
    changeReason: "仕様変更",
    removed: { items: [{ number: "1", description: "削除AC" }] },
    addedGroups: [{
      pbiNumber: 1,
      wpNumber: "1",
      acJudgments: [{ number: "2", description: "追加AC" }],
    }],
  });
});

/**
 * parseReviewBody: sprint goal / PBI/WP summary を含む本文から正しく抽出できる。
 */
Deno.test("revise-sprint-review - parseReviewBody should extract sprintGoal and summaries", () => {
  const body = [
    "## 凡例",
    "",
    "- ❔ 未確認",
    "",
    "## スプリントゴール",
    "",
    "Sprint 17 の目標",
    "",
    "## 概要",
    "",
    "- **対象スプリント**: Sprint 17",
    "",
    "## 総合判定",
    "",
    "❔",
    "",
    "## スプリント開始時検証計画",
    "",
    "### 📦 PBI: [1] PBIタイトル",
    "",
    "- **概要**: PBIの概要です",
    "",
    "#### WP_1: WP1タイトル",
    "",
    "- **概要**: WP1の概要です",
    "",
    "- ❔ AC_1: AC1の説明",
    "",
    "#### WP_2: WP2タイトル",
    "",
    "- ❔ AC_2: AC2の説明",
    "",
    "## スプリント中追加検証計画",
    "",
  ].join("\n");

  const parsed = parseReviewBody(body);
  assertEquals(parsed.sprintGoal, "Sprint 17 の目標");
  assertEquals(parsed.pbis.length, 1);
  assertEquals(parsed.pbis[0].number, 1);
  assertEquals(parsed.pbis[0].title, "PBIタイトル");
  assertEquals(parsed.pbis[0].summary, "PBIの概要です");
  assertEquals(parsed.pbis[0].wps.length, 2);
  assertEquals(parsed.pbis[0].wps[0].title, "WP1タイトル");
  assertEquals(parsed.pbis[0].wps[0].summary, "WP1の概要です");
  assertEquals(parsed.pbis[0].wps[1].title, "WP2タイトル");
  assertEquals(parsed.pbis[0].wps[1].summary, undefined);
});

/**
 * parseReviewBody: 概要やゴールがない本文でも安全に最低限の構造を返す。
 */
Deno.test("revise-sprint-review - parseReviewBody should handle body without summaries", () => {
  const body = [
    "## 凡例",
    "",
    "## 概要",
    "",
    "- **対象スプリント**: Sprint 17",
    "",
    "## スプリント開始時検証計画",
    "",
    "### 📦 PBI: [1] タイトル",
    "",
    "#### WP_1: WPタイトル",
    "",
    "- ❔ AC_1: AC1",
    "",
  ].join("\n");

  const parsed = parseReviewBody(body);
  assertEquals(parsed.sprintGoal, undefined);
  assertEquals(parsed.pbis.length, 1);
  assertEquals(parsed.pbis[0].summary, undefined);
  assertEquals(parsed.pbis[0].wps[0].summary, undefined);
});

/**
 * parseReviewBody: undefined / 空文字でもエラーにならない。
 */
Deno.test("revise-sprint-review - parseReviewBody should handle undefined body", () => {
  const parsed = parseReviewBody(undefined);
  assertEquals(parsed.sprintGoal, undefined);
  assertEquals(parsed.pbis.length, 0);
});

/**
 * round-trip: formatPlanBody の出力を parseReviewBody で正しく再パースできる。
 */
Deno.test("revise-sprint-review - round-trip formatPlanBody -> parseReviewBody", () => {
  const identifier: ReviewIdentifier = {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 17 Review" },
    id: "review-1",
    code: "42",
    describe: () => ({ summary: "describe", steps: [] }),
  };
  const sprint: SprintIdentifier = {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 17" },
    id: "sprint-17",
    code: "17",
    describe: () => ({ summary: "describe", steps: [] }),
  };
  const planInput: ReviewPlanInput = {
    sprintGoal: "Sprint 17 の目標",
    pbis: [{
      number: 1,
      title: "PBIタイトル",
      summary: "PBIの概要",
      wps: [{
        number: 1,
        title: "WPタイトル",
        summary: "WPの概要",
        acs: [{ number: "1", description: "AC1" }],
      }],
    }],
  };

  const plan = reviewUseCase.plan(identifier, sprint, planInput);
  const body = plan.steps[0].params.body as string;

  const parsed = parseReviewBody(body);
  assertEquals(parsed.sprintGoal, "Sprint 17 の目標");
  assertEquals(parsed.pbis.length, 1);
  assertEquals(parsed.pbis[0].summary, "PBIの概要");
  assertEquals(parsed.pbis[0].wps[0].summary, "WPの概要");
  assertEquals(parsed.pbis[0].number, 1);
  assertEquals(parsed.pbis[0].title, "PBIタイトル");
  assertEquals(parsed.pbis[0].wps[0].number, "1");
  assertEquals(parsed.pbis[0].wps[0].title, "WPタイトル");
});

/**
 * round-trip: 概要なしの場合も往復が成立する。
 */
Deno.test("revise-sprint-review - round-trip without summaries", () => {
  const identifier: ReviewIdentifier = {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 17 Review" },
    id: "review-1",
    code: "42",
    describe: () => ({ summary: "describe", steps: [] }),
  };
  const sprint: SprintIdentifier = {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 17" },
    id: "sprint-17",
    code: "17",
    describe: () => ({ summary: "describe", steps: [] }),
  };
  const planInput: ReviewPlanInput = {
    pbis: [{
      number: 1,
      title: "PBIタイトル",
      wps: [{
        number: 1,
        title: "WPタイトル",
        acs: [{ number: "1", description: "AC1" }],
      }],
    }],
  };

  const plan = reviewUseCase.plan(identifier, sprint, planInput);
  const body = plan.steps[0].params.body as string;

  const parsed = parseReviewBody(body);
  assertEquals(parsed.sprintGoal, undefined);
  assertEquals(parsed.pbis[0].summary, undefined);
  assertEquals(parsed.pbis[0].wps[0].summary, undefined);
});
