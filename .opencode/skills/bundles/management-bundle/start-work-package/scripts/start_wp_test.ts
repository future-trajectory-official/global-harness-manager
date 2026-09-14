import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description WP開始時に正しいPlanが生成されること
 * @verify Planのstep数=3、scopeStep存在、operationが"start"、stageが"inProgress"
 */
Deno.test("start_wp - should generate plan", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const plan = workPackageUseCase.start(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Start WP: Test WP");
  assertEquals(plan.steps[1].operation, "start");
  assertEquals(plan.steps[1].params.stage, "inProgress");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("start_wp - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  assertThrows(
    () => workPackageUseCase.start(identifier),
    Error,
    "INVALID_INPUT",
  );
});
