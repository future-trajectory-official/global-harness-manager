import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewIdentifier } from "../../../../../core/domain/types.ts";
import { validateCommonInput, validateReviseInput } from "./revise_sprint_review.ts";

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
    wpNumber: 2,
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
    wpNumber: 2,
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
      wpNumber: 1,
      acJudgments: [{ number: "2", description: "追加AC" }],
    }],
  });
});
