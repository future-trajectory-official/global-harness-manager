import { assertEquals, assertThrows } from "@std/assert";
import { pbiId } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { validateInput } from "./start_pbi.ts";

/**
 * @description PBI着手時に正しいPlanが生成されること
 * @verify Planのstep数=2、scopeStep存在、operationが"start"
 */
Deno.test("start_pbi - should generate plan", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const plan = productBacklogItemUseCase.start(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Start PBI: Test PBI");
  assertEquals(plan.steps[1].operation, "start");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("start_pbi - should throw for missing identifier id", () => {
  const identifier = pbiId("Test-PBI");
  assertThrows(
    () => productBacklogItemUseCase.start(identifier),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description スクリプト固有の入力検証（validateInput）が動作すること
 * @verify id 空で INVALID_INPUT、identifier 欠落で INVALID_INPUT がスローされること
 */
Deno.test("start_pbi - validateInput should reject empty identifier.id", () => {
  assertThrows(
    () => validateInput({ identifier: { title: "PBI", id: "" } }),
    Error,
    "identifier.id must not be empty",
  );
});

/**
 * @description validateInput が有効な入力を通過させること
 * @verify 正常系では例外が発生しないこと
 */
Deno.test("start_pbi - validateInput should pass valid input", () => {
  validateInput({ identifier: { title: "PBI", id: "node-1", code: "42" } });
});
