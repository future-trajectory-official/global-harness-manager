import { assertEquals } from "@std/assert";
import { hasPlannedEstimate } from "./work-package-handler.ts";

Deno.test("hasPlannedEstimate - returns true when planned_estimate exists", () => {
  assertEquals(
    hasPlannedEstimate('{"initial_estimate":3,"planned_estimate":5,"actual":4}'),
    true,
  );
});

Deno.test("hasPlannedEstimate - returns false for empty string", () => {
  assertEquals(hasPlannedEstimate(""), false);
});

Deno.test("hasPlannedEstimate - returns false for null", () => {
  assertEquals(hasPlannedEstimate(null), false);
});

Deno.test("hasPlannedEstimate - returns false for undefined", () => {
  assertEquals(hasPlannedEstimate(undefined), false);
});

Deno.test("hasPlannedEstimate - returns false when planned_estimate is missing", () => {
  assertEquals(
    hasPlannedEstimate('{"initial_estimate":3,"actual":4}'),
    false,
  );
});

Deno.test("hasPlannedEstimate - returns false for invalid JSON", () => {
  assertEquals(hasPlannedEstimate("not-json"), false);
});

Deno.test("hasPlannedEstimate - returns false for empty object", () => {
  assertEquals(hasPlannedEstimate("{}"), false);
});
