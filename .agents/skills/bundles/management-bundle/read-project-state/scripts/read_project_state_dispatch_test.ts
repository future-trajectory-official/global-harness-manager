import { assertEquals, assertExists } from "@std/assert";
import { buildPlan } from "./read_project_state.ts";
import type { Plan } from "../../../../../core/domain/types.ts";

/**
 * 生成された Plan の指定 entity の step を探す。
 * search は Scope:resolve が前置されるため、対象 entity の step を検索する。
 */
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
    const plan = buildPlan(
      {
        entityType,
        operation: "search",
        params,
      } as Parameters<typeof buildPlan>[0],
    );

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
    const plan = buildPlan(
      {
        entityType,
        operation: "find",
        params: { itemId: "42" },
      } as Parameters<typeof buildPlan>[0],
    );

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
  const latestPlan = buildPlan(
    {
      entityType: "Sprint",
      operation: "find",
      params: {},
    } as Parameters<typeof buildPlan>[0],
  );
  const latestStep = findStep(latestPlan, "Sprint", "search");
  assertExists(latestStep, "latest open search step not found");
  assertEquals(latestStep.params.state, "open");

  const byNumberPlan = buildPlan(
    {
      entityType: "Sprint",
      operation: "find",
      params: { itemId: "19" },
    } as Parameters<typeof buildPlan>[0],
  );
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
    let thrown = "";
    try {
      buildPlan(
        {
          entityType,
          operation: "search",
          params: {},
        } as Parameters<typeof buildPlan>[0],
      );
    } catch (e) {
      thrown = (e as Error).message;
    }
    assertExists(
      thrown.match(/search is not supported for/),
      `expected unsupported error, got: ${thrown}`,
    );
  });
}

/**
 * @description 対象外・未指定の EntityType / operation が INVALID_INPUT エラーを投げること
 * @verify 未知の entityType と operation で明確なエラーが投げられること
 */
Deno.test("read_project_state dispatch - unknown entityType and operation throw", () => {
  let thrown1 = "";
  try {
    buildPlan({
      entityType: "Unknown" as Parameters<typeof buildPlan>[0]["entityType"],
      operation: "find",
      params: {},
    });
  } catch (e) {
    thrown1 = (e as Error).message;
  }
  assertExists(thrown1.match(/Unknown entityType/), `expected Unknown entityType, got: ${thrown1}`);

  let thrown2 = "";
  try {
    buildPlan({
      entityType: "Epic",
      operation: "unknown" as Parameters<typeof buildPlan>[0]["operation"],
      params: {},
    });
  } catch (e) {
    thrown2 = (e as Error).message;
  }
  assertExists(thrown2.match(/operation must be/), `expected operation error, got: ${thrown2}`);
});
