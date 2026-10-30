import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { validateInput } from "./complete_wp.ts";

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

/**
 * @description 指定AC番号がPlanのparamsへ伝播すること（AC2-877）
 * @verify acceptanceCriteria 指定時は入力配列と一致し、省略時は undefined であること
 */
Deno.test("complete_wp - should propagate acceptanceCriteria into plan params (AC2-877)", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const plan = workPackageUseCase.complete(identifier, { acceptanceCriteria: [1, 3] });
  assertEquals(plan.steps[1].params.acceptanceCriteria, [1, 3]);

  const omitted = workPackageUseCase.complete(identifier);
  assertEquals(omitted.steps[1].params.acceptanceCriteria, undefined);
});

/**
 * @description 不正な acceptanceCriteria を入力検証で拒否すること（AC2-877）
 * @verify 0・非整数で INVALID_INPUT が投げられ、正の整数配列は通ること
 */
Deno.test("complete_wp - should reject invalid acceptanceCriteria (AC2-877)", () => {
  const base = { identifier: { title: "T", id: "node", code: "42" } };
  assertThrows(
    () => validateInput({ ...base, acceptanceCriteria: [0] }),
    Error,
    "INVALID_INPUT",
  );
  assertThrows(
    () => validateInput({ ...base, acceptanceCriteria: [1.5] }),
    Error,
    "INVALID_INPUT",
  );
  validateInput({ ...base, acceptanceCriteria: [1, 2] });
});

/**
 * @description 空配列の acceptanceCriteria を拒否すること（M3-877）
 * @verify INVALID_INPUT が投げられること
 */
Deno.test("complete_wp - should reject empty acceptanceCriteria (M3-877)", () => {
  const base = { identifier: { title: "T", id: "node", code: "42" } };
  assertThrows(() => validateInput({ ...base, acceptanceCriteria: [] }), Error, "INVALID_INPUT");
});
