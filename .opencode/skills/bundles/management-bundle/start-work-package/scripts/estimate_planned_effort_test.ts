import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import type { EffortRecord } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description 計画工数見積もり時に正しいPlanが生成されること
 * @verify Planのstep数=2、scopeStep存在、operationが"estimatePlannedEffort"、effortPlannedが入力値と一致
 */
Deno.test("estimate_planned_effort - should generate plan", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 0, plannedEstimate: 3 };
  const plan = workPackageUseCase.estimatePlannedEffort(identifier, effort);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Estimate planned effort for WP: Test WP");
  assertEquals(plan.steps[1].operation, "estimatePlannedEffort");
  assertEquals(plan.steps[1].params.effortPlanned, 3);
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("estimate_planned_effort - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  const effort: EffortRecord = { initialEstimate: 0, plannedEstimate: 3 };
  assertThrows(
    () => workPackageUseCase.estimatePlannedEffort(identifier, effort),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 計画工数が0（境界値）でも正しくPlanが生成されること
 * @verify effortPlanned=0のStepが生成されること
 */
Deno.test("estimate_planned_effort - should handle zero estimate", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 0, plannedEstimate: 0 };
  const plan = workPackageUseCase.estimatePlannedEffort(identifier, effort);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].params.effortPlanned, 0);
});
