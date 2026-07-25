import { assertEquals, assertThrows } from "@std/assert";
import { pbiId, Size } from "../../../../../core/domain/types.ts";
import type { SizeVariance } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";

Deno.test("estimate_pbi_size - should generate plan with valid size", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const variance: SizeVariance = { estimate: Size.M };
  const plan = productBacklogItemUseCase.estimateSize(identifier, variance);
  assertEquals(plan.summary, "Estimate size for PBI: Test PBI");
  assertEquals(plan.steps[1].operation, "estimateSize");
  assertEquals(plan.steps[1].params.sizeEstimate, "M");
});

Deno.test("estimate_pbi_size - should throw for invalid size string", () => {
  const sizeObj = Size.fromString("INVALID");
  assertEquals(sizeObj, undefined);
});

Deno.test("estimate_pbi_size - should throw for missing identifier id", () => {
  const identifier = pbiId("Test PBI");
  const variance: SizeVariance = { estimate: Size.S };
  assertThrows(
    () => productBacklogItemUseCase.estimateSize(identifier, variance),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("estimate_pbi_size - should handle XS size", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const variance: SizeVariance = { estimate: Size.XS };
  const plan = productBacklogItemUseCase.estimateSize(identifier, variance);
  assertEquals(plan.steps[1].params.sizeEstimate, "XS");
});

Deno.test("estimate_pbi_size - should handle XL size", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const variance: SizeVariance = { estimate: Size.XL };
  const plan = productBacklogItemUseCase.estimateSize(identifier, variance);
  assertEquals(plan.steps[1].params.sizeEstimate, "XL");
});
