import { assertEquals, assertThrows } from "@std/assert";
import { pbiId } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";

/**
 * @description PBI完了時に正しいPlanが生成されること
 * @verify Planのstep数=3、scopeStep存在、operationが"complete"
 */
Deno.test("complete_pbi - should generate plan", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const plan = productBacklogItemUseCase.complete(identifier);
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Complete PBI: Test PBI");
  assertEquals(plan.steps[1].operation, "complete");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("complete_pbi - should throw for missing identifier id", () => {
  const identifier = pbiId("Test PBI");
  assertThrows(
    () => productBacklogItemUseCase.complete(identifier),
    Error,
    "INVALID_INPUT",
  );
});
