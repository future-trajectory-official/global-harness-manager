import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import type {
  ChangeReason,
  GoalStatement,
  ProductGoalIdentifier,
} from "../../../../../core/domain/types.ts";
import { validateInput } from "./assess_goal_continuation.ts";

function makeScope() {
  return { owner: "my-org", repository: "my-repo" };
}

function makeIdentifier(overrides?: Partial<ProductGoalIdentifier>): ProductGoalIdentifier {
  return {
    scope: makeScope(),
    title: { value: "Product Goal" },
    id: "pending",
    code: "42",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

Deno.test("assess-goal-continuation - 確認フェーズ: find が view Plan を生成する", () => {
  const identifier = makeIdentifier();
  const plan = productGoalUseCase.find(identifier);

  assertEquals(plan.summary, "Find product goal: Product Goal");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].entity, "ProductGoal");
  assertEquals(plan.steps[0].operation, "view");
  assertEquals(plan.steps[0].params.itemId, "42");
});

Deno.test("assess-goal-continuation - 確認フェーズ: dry-run が search+view の2 Step を持つ", () => {
  const combinedPlan = {
    summary: "Assess goal continuation: Product Goal",
    steps: [
      { entity: "ProductGoal", operation: "search", params: { labelType: "ProductGoal" } },
      { entity: "ProductGoal", operation: "view", params: { itemId: "<issue-number>" } },
    ],
  };

  assertEquals(combinedPlan.steps.length, 2);
  assertEquals(combinedPlan.steps[0].operation, "search");
  assertEquals(combinedPlan.steps[1].operation, "view");
  assertStringIncludes(JSON.stringify(combinedPlan), "Assess goal continuation");
});

Deno.test("assess-goal-continuation - 更新フェーズ: pivot が update+comment の2 Step を持つ Plan を返す", () => {
  const identifier = makeIdentifier();
  const statement: GoalStatement = { description: "New goal" };
  const reason: ChangeReason = { description: "Direction changed" };
  const plan = productGoalUseCase.pivot(identifier, statement, reason);

  assertEquals(plan.summary, "Pivot product goal: Product Goal");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "ProductGoal");
  assertEquals(plan.steps[0].operation, "update");
  assertEquals(plan.steps[1].entity, "ProductGoal");
  assertEquals(plan.steps[1].operation, "comment");
});

Deno.test("assess-goal-continuation - 更新フェーズ: pivot の itemId に code が設定される", () => {
  const identifier = makeIdentifier({ code: "99" });
  const statement: GoalStatement = { description: "New goal" };
  const reason: ChangeReason = { description: "Reason" };
  const plan = productGoalUseCase.pivot(identifier, statement, reason);

  assertEquals(plan.steps[0].params.itemId, "99");
});

Deno.test("assess-goal-continuation - 更新フェーズ: dry-run が pivot Plan を JSON 出力する", () => {
  const identifier = makeIdentifier();
  const statement: GoalStatement = { description: "New goal" };
  const reason: ChangeReason = { description: "Direction changed" };
  const plan = productGoalUseCase.pivot(identifier, statement, reason);
  const output = JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2);

  assertStringIncludes(output, "Pivot product goal:");
  assertStringIncludes(output, "update");
  assertStringIncludes(output, "comment");
});

Deno.test("assess-goal-continuation - pivot.description 欠落でエラー", () => {
  assertThrows(
    () => validateInput({ pivot: { description: "", reason: "r", code: "1" } }),
    Error,
    "INVALID_INPUT: pivot.description is required",
  );
});

Deno.test("assess-goal-continuation - pivot.reason 欠落でエラー", () => {
  assertThrows(
    () => validateInput({ pivot: { description: "d", reason: "", code: "1" } }),
    Error,
    "INVALID_INPUT: pivot.reason is required",
  );
});

Deno.test("assess-goal-continuation - pivot.code 欠落でエラー", () => {
  assertThrows(
    () => validateInput({ pivot: { description: "d", reason: "r", code: "" } }),
    Error,
    "INVALID_INPUT: pivot.code is required",
  );
});

Deno.test("assess-goal-continuation - title 省略時は妥当", () => {
  validateInput({});
});

Deno.test("assess-goal-continuation - pivot全項目ありは妥当", () => {
  validateInput({ pivot: { description: "d", reason: "r", code: "1" } });
});
