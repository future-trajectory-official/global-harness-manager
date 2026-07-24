import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import type { EffortRecord } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

Deno.test("estimate_wp_initial_effort - should generate plan", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 3 };
  const plan = workPackageUseCase.estimateInitialEffort(identifier, effort);
  assertEquals(plan.summary, "Estimate initial effort for WP: Test WP");
  assertEquals(plan.steps[1].operation, "estimateInitialEffort");
  assertEquals(plan.steps[1].params.effortInitial, 3);
});

Deno.test("estimate_wp_initial_effort - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  const effort: EffortRecord = { initialEstimate: 3 };
  assertThrows(
    () => workPackageUseCase.estimateInitialEffort(identifier, effort),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("estimate_wp_initial_effort - should handle zero estimate", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 0 };
  const plan = workPackageUseCase.estimateInitialEffort(identifier, effort);
  assertEquals(plan.steps[1].params.effortInitial, 0);
});
