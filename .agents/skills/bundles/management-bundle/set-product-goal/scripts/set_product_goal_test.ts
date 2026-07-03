import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import type { GoalStatement, ProductGoalIdentifier } from "../../../../../core/domain/types.ts";
import { identify } from "../../../../../core/domain/types.ts";
import { validateInput } from "./set_product_goal.ts";

function makeIdentifier(overrides?: Partial<ProductGoalIdentifier>): ProductGoalIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Product Goal" },
    id: undefined,
    code: undefined,
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeStatement(description: string): GoalStatement {
  return { description };
}

Deno.test("set-product-goal - set が create と comment の2 Step を持つ Plan を返す", () => {
  const identifier = makeIdentifier();
  const plan = productGoalUseCase.set(identifier, makeStatement("Goal description"));

  assertEquals(plan.summary, "Set product goal: Product Goal");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "ProductGoal");
  assertEquals(plan.steps[0].operation, "create");
  assertEquals(plan.steps[1].entity, "ProductGoal");
  assertEquals(plan.steps[1].operation, "comment");
});

Deno.test("set-product-goal - set の create Step に title と body が含まれる", () => {
  const identifier = makeIdentifier();
  const plan = productGoalUseCase.set(identifier, makeStatement("Goal description"));

  assertEquals(plan.steps[0].params.title, "Product Goal");
  assertStringIncludes(plan.steps[0].params.body as string, "## History");
});

Deno.test("set-product-goal - set の comment Step に GoalStatement が含まれる", () => {
  const identifier = makeIdentifier();
  const plan = productGoalUseCase.set(identifier, makeStatement("Goal description"));

  assertStringIncludes(plan.steps[1].params.body as string, "## Goal");
  assertStringIncludes(plan.steps[1].params.body as string, "Goal description");
});

Deno.test("set-product-goal - title が空文字の場合エラーを投げる", () => {
  const identifier = makeIdentifier({ title: { value: "" } });
  assertThrows(
    () => productGoalUseCase.set(identifier, makeStatement("desc")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("set-product-goal - description が空文字の場合エラーを投げる", () => {
  const identifier = makeIdentifier();
  assertThrows(
    () => productGoalUseCase.set(identifier, makeStatement("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("set-product-goal - dry-run 出力が Plan 構造の JSON である", () => {
  const identifier = makeIdentifier();
  const plan = productGoalUseCase.set(identifier, makeStatement("Goal description"));
  const output = JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2);

  assertStringIncludes(output, "Set product goal:");
  assertStringIncludes(output, "ProductGoal");
  assertStringIncludes(output, "create");
  assertStringIncludes(output, "comment");
});

Deno.test("set-product-goal - identify で新規作成用 Identifier が生成される", () => {
  const scope = { owner: "my-org", repository: "my-repo" };
  const identifier = identify(scope, "Product Goal");

  assertEquals(identifier.title.value, "Product Goal");
  assertEquals(identifier.id, undefined);
  assertEquals(identifier.code, undefined);
});

Deno.test("set-product-goal - validateInput が description 欠落時にエラーを投げる", () => {
  assertThrows(
    () => validateInput({ description: "" }),
    Error,
    "INVALID_INPUT: description is required",
  );
});
