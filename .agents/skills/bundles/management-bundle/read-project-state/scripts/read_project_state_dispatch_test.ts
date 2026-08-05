import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { buildPlan, type ReadProjectStateInput } from "./read_project_state.ts";
import type { Plan } from "../../../../../core/domain/types.ts";

type Input = ReadProjectStateInput;

/** 生成された Plan の指定 entity の step を探す。 */
function findStep(plan: Plan, entity: string, operation: string) {
  return plan.steps.find((s) => s.entity === entity && s.operation === operation);
}

/**
 * @description search が正しい UseCase へ委譲され、labelType を含む search step を持つ Plan を生成すること
 * @verify searchPlan.steps に対象 entity の operation=search step が含まれ、params.labelType が正しいこと
 */
for (
  const [entityType, labelType, conditionKey] of [
    ["Epic", "Epic", "keyword"],
    ["Feature", "Feature", "keyword"],
    ["ProductBacklogItem", "PBI", "status"],
    ["WorkPackage", "WP", "status"],
    ["Review", "Review", "sprintNumber"],
    ["Retrospective", "Retrospective", "sprintNumber"],
  ] as const
) {
  Deno.test(`read_project_state dispatch - ${entityType} search delegates to use case`, () => {
    const params: Record<string, unknown> = { [conditionKey]: "42" };
    const plan = buildPlan({ entityType, operation: "search", params } as Input);

    const step = findStep(plan, entityType, "search");
    assertExists(step, `search step for ${entityType} not found`);
    assertEquals(step.params.labelType, labelType);
    assertEquals(step.params[conditionKey], "42");
  });
}

/**
 * @description find が正しい UseCase へ委譲され、itemId を含む view step を持つ Plan を生成すること
 * @verify view step の params.itemId が入力の itemId と一致すること
 */
for (
  const entityType of [
    "Vision",
    "ProductGoal",
    "Epic",
    "Feature",
    "ProductBacklogItem",
    "WorkPackage",
    "Review",
    "Retrospective",
  ] as const
) {
  Deno.test(`read_project_state dispatch - ${entityType} find by code delegates to use case`, () => {
    const plan = buildPlan({ entityType, operation: "find", params: { itemId: "42" } } as Input);

    const step = findStep(plan, entityType, "view");
    assertExists(step, `view step for ${entityType} not found`);
    assertEquals(step.params.itemId, "42");
  });
}

/**
 * @description Sprint の find が code なしで「最新オープン」の Plan、code ありで番号指定の Plan を生成すること
 * @verify code なし: Sprint search step が含まれる。code あり: view step の itemId が指定値であること
 */
Deno.test("read_project_state dispatch - Sprint find resolves latest open or by number", () => {
  const latestPlan = buildPlan({ entityType: "Sprint", operation: "find", params: {} } as Input);
  const latestStep = findStep(latestPlan, "Sprint", "search");
  assertExists(latestStep, "latest open search step not found");
  assertEquals(latestStep.params.state, "open");

  const byNumberPlan = buildPlan({
    entityType: "Sprint",
    operation: "find",
    params: { itemId: "19" },
  } as Input);
  const byNumberStep = findStep(byNumberPlan, "Sprint", "view");
  assertExists(byNumberStep, "by-number view step not found");
  assertEquals(byNumberStep.params.itemId, "19");
});

/**
 * @description 単一インスタンスEntity（Vision / ProductGoal / Sprint）の search が対象外エラーを投げること
 * @verify buildPlan が "search is not supported" のエラーを投げること
 */
for (const entityType of ["Vision", "ProductGoal", "Sprint"] as const) {
  Deno.test(`read_project_state dispatch - ${entityType} search throws unsupported error`, () => {
    assertThrows(
      () => buildPlan({ entityType, operation: "search", params: {} } as Input),
      Error,
      "search is not supported for",
    );
  });
}

/**
 * @description status フィルタ未対応Entity（Epic / Feature / Review）の search が明示エラーを投げること
 * @verify buildPlan が "status filter is not supported" のエラーを投げ、黙殺して全件返さないこと
 */
for (const entityType of ["Epic", "Feature", "Review"] as const) {
  Deno.test(`read_project_state dispatch - ${entityType} search with status throws error`, () => {
    assertThrows(
      () => buildPlan({ entityType, operation: "search", params: { status: "Todo" } } as Input),
      Error,
      "status filter is not supported",
    );
  });
}

/**
 * @description 対象外・未指定の EntityType / operation が INVALID_INPUT エラーを投げること
 * @verify 未知の entityType と operation で明確なエラーが投げられること
 */
Deno.test("read_project_state dispatch - unknown entityType and operation throw", () => {
  assertThrows(
    () =>
      buildPlan({ entityType: "Unknown" as Input["entityType"], operation: "find", params: {} }),
    Error,
    "Unknown entityType",
  );
  assertThrows(
    () => buildPlan({ entityType: "Epic", operation: "unknown" as Input["operation"], params: {} }),
    Error,
    "operation must be",
  );
});

/**
 * @description Scope の search / find が「非エンティティ」専用エラーを投げること
 * @verify 誤解を招く「single-instance」文言ではなく、Scope 専用のエラーが投げられること
 */
Deno.test("read_project_state dispatch - Scope throws dedicated error", () => {
  assertThrows(
    () => buildPlan({ entityType: "Scope", operation: "search", params: {} }),
    Error,
    "Scope is not a searchable/findable entity",
  );
  assertThrows(
    () => buildPlan({ entityType: "Scope", operation: "find", params: {} }),
    Error,
    "Scope is not a searchable/findable entity",
  );
});
