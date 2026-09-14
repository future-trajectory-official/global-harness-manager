import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import type { ChangeReason, GoalStatement, ProductGoalIdentifier } from "./types.ts";
import { formatGoalBody, formatGoalComment, productGoalUseCase } from "./product-goal-usecase.ts";

function makeIdentifier(overrides?: Partial<ProductGoalIdentifier>): ProductGoalIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Product Goal" },
    id: "goal-1",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeStatement(overrides?: Partial<GoalStatement>): GoalStatement {
  return {
    description: "Improve developer productivity",
    ...overrides,
  };
}

function makeReason(description = "Strategy change"): ChangeReason {
  return { description };
}

Deno.test("productGoalUseCase - set should return Plan with create + comment", () => {
  const plan = productGoalUseCase.set(makeIdentifier(), makeStatement());
  assertEquals(plan.summary, "Set product goal: Product Goal");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "create");
  assertEquals(plan.steps[2].operation, "comment");
});

Deno.test("productGoalUseCase - set body should be history table", () => {
  const plan = productGoalUseCase.set(makeIdentifier(), makeStatement());
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "## History");
  assertStringIncludes(body, "| 1 | プロジェクト開始 |");
});

Deno.test("productGoalUseCase - set comment should be versioned", () => {
  const plan = productGoalUseCase.set(makeIdentifier(), makeStatement());
  const comment = plan.steps[2].params.body as string;
  assertStringIncludes(comment, "# Version: 1");
  assertStringIncludes(comment, "## Goal");
});

Deno.test("productGoalUseCase - set should throw for empty title", () => {
  assertThrows(
    () => productGoalUseCase.set(makeIdentifier({ title: { value: "" } }), makeStatement()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("productGoalUseCase - set should throw for empty description", () => {
  assertThrows(
    () => productGoalUseCase.set(makeIdentifier(), makeStatement({ description: "" })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("productGoalUseCase - pivot should return Plan with update + comment", () => {
  const plan = productGoalUseCase.pivot(makeIdentifier(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Pivot product goal: Product Goal");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "update");
  assertEquals(plan.steps[2].operation, "comment");
});

Deno.test("productGoalUseCase - pivot should throw for empty reason", () => {
  assertThrows(
    () => productGoalUseCase.pivot(makeIdentifier(), makeStatement(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("productGoalUseCase - pivot should throw for undefined id", () => {
  assertThrows(
    () =>
      productGoalUseCase.pivot(makeIdentifier({ id: undefined }), makeStatement(), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("productGoalUseCase - find should return Plan with view step", () => {
  const plan = productGoalUseCase.find(makeIdentifier());
  assertEquals(plan.summary, "Find product goal: Product Goal");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
});

/**
 * find の正常系（codeのみ）。id が undefined でも code があれば Plan が返ることを確認する。
 * @description read-project-state スキルは Issue 番号（code）を主キーに find を呼ぶため、id 無しで成立すること
 * @verify code="42" を保持したまま find が Plan を返し、view 操作を含むこと
 */
Deno.test("productGoalUseCase - find should succeed with code even if id is undefined", () => {
  const plan = productGoalUseCase.find(makeIdentifier({ id: undefined, code: "42" }));
  assertEquals(plan.summary, "Find product goal: Product Goal");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
  assertEquals(plan.steps[1].params.itemId, "42");
});

/**
 * find の異常系。id と code の両方が undefined の場合にエラーがスローされることを確認する。
 * @description 参照識別子（id/code）が完全に欠落している場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("productGoalUseCase - find should throw when both id and code are undefined", () => {
  assertThrows(
    () => productGoalUseCase.find(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("productGoalUseCase - find should throw for empty title", () => {
  assertThrows(
    () => productGoalUseCase.find(makeIdentifier({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("formatGoalBody - should generate history table", () => {
  const body = formatGoalBody(1, makeStatement());
  assertStringIncludes(body, "## History");
  assertStringIncludes(body, "| 日付 | バージョン | 概要 |");
});

Deno.test("formatGoalComment - should generate L2-compliant comment", () => {
  const comment = formatGoalComment(makeStatement(), 1);
  assertStringIncludes(comment, "# Version: 1");
  assertStringIncludes(comment, "## Goal");
  assertStringIncludes(comment, "Improve developer productivity");
});
