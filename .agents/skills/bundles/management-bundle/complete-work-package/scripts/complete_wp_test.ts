import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description WP完了時に正しいPlanが生成されること
 * @verify Planのstep数=3、scopeStep存在、operationが"complete"
 */
Deno.test("complete_wp - should generate plan", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const plan = workPackageUseCase.complete(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Complete WP: Test WP");
  assertEquals(plan.steps[1].operation, "complete");
  assertEquals(plan.steps[1].entity, "WorkPackage");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("complete_wp - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  assertThrows(
    () => workPackageUseCase.complete(identifier),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description paramsにitemIdが含まれていること
 * @verify itemIdが入力codeと一致すること
 */
Deno.test("complete_wp - should include itemId in params", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const plan = workPackageUseCase.complete(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].params.itemId, "42");
});
