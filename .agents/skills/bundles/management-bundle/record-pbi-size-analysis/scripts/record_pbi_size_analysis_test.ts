import { assertEquals, assertThrows } from "@std/assert";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { pbiId, Size } from "../../../../../core/domain/types.ts";
import { buildPlan, validateInput } from "./record_pbi_size_analysis.ts";

const IDENTIFIER = { title: "Sprint-End-Persistence", id: "node-id", code: "614" };

/**
 * @description confirmSize が正しい Plan（confirmSize操作）を生成すること
 * @verify actual に Size.M、varianceReason が反映されること
 */
Deno.test("record_pbi_size_analysis - confirmSize plan", () => {
  const identifier = pbiId(IDENTIFIER.title, IDENTIFIER.id, IDENTIFIER.code);
  const plan = productBacklogItemUseCase.confirmSize(identifier, {
    actual: Size.M,
    varianceReason: "scope expanded",
  });
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "confirmSize");
  assertEquals(plan.steps[1].params.sizeActual, "M");
  assertEquals(plan.steps[1].params.sizeVarianceReason, "scope expanded");
});

/**
 * @description validateInput が不正な sizeActual を拒否すること
 * @verify XXL で INVALID_INPUT エラーになること
 */
Deno.test("record_pbi_size_analysis - validateInput rejects invalid size", () => {
  assertThrows(
    () => validateInput({ identifier: IDENTIFIER, sizeActual: "XXL" }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が sizeActual 空を拒否すること
 * @verify 空文字で INVALID_INPUT エラーになること
 */
Deno.test("record_pbi_size_analysis - validateInput rejects empty size", () => {
  assertThrows(
    () => validateInput({ identifier: IDENTIFIER, sizeActual: "" }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description buildPlan が varianceReason 省略時に空文字で confirmSize Plan を生成すること
 * @verify sizeVarianceReason が "" になること
 */
Deno.test("record_pbi_size_analysis - buildPlan defaults varianceReason to empty string", () => {
  const plan = buildPlan({ identifier: IDENTIFIER, sizeActual: "M" });
  assertEquals(plan.steps[1].operation, "confirmSize");
  assertEquals(plan.steps[1].params.sizeActual, "M");
  assertEquals(plan.steps[1].params.sizeVarianceReason, "");
});
