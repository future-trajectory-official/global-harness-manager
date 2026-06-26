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

Deno.test("productGoalUseCase - set should return Plan with createItem + addComment", () => {
  const plan = productGoalUseCase.set(makeIdentifier(), makeStatement());
  assertEquals(plan.summary, "Set product goal: Product Goal");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "createItem");
  assertEquals(plan.steps[0].params.type, "Goal");
  assertEquals(plan.steps[1].operation, "addComment");
});

Deno.test("productGoalUseCase - set body should be history table", () => {
  const plan = productGoalUseCase.set(makeIdentifier(), makeStatement());
  const body = plan.steps[0].params.body as string;
  assertStringIncludes(body, "## History");
  assertStringIncludes(body, "| 1 | Improve developer productivity... |");
});

Deno.test("productGoalUseCase - set comment should be versioned", () => {
  const plan = productGoalUseCase.set(makeIdentifier(), makeStatement());
  const comment = plan.steps[1].params.body as string;
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

Deno.test("productGoalUseCase - pivot should return Plan with updateItem + addComment", () => {
  const plan = productGoalUseCase.pivot(makeIdentifier(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Pivot product goal: Product Goal");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[1].operation, "addComment");
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

Deno.test("productGoalUseCase - find should return Plan with findItem operation", () => {
  const plan = productGoalUseCase.find(makeIdentifier());
  assertEquals(plan.summary, "Find product goal: Product Goal");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "findItem");
});

Deno.test("productGoalUseCase - find should throw for undefined id", () => {
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
