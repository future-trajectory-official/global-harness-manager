import { assertEquals, assertThrows } from "@std/assert";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";
import type { VelocityMetrics } from "../../../../../core/domain/sprint-usecase.ts";
import { sprintRef } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { validateInput } from "./record_sprint_velocity.ts";

const VELOCITY: Omit<VelocityMetrics, "sprintNumber"> = {
  pbiCount: 5,
  totalWeight: 21,
  matchRate: 0.8,
  summary: "all WP completed within plan",
};

/**
 * @description recordVelocity が正しい Plan（recordVelocity操作）を生成すること
 * @verify itemId に code、params.velocity が反映されること
 */
Deno.test("record_sprint_velocity - recordVelocity plan", () => {
  const identifier = sprintRef(16, "node-id", "16");
  const plan = sprintUseCase.recordVelocity(identifier, { ...VELOCITY, sprintNumber: 16 }) as Plan;
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].entity, "Sprint");
  assertEquals(plan.steps[1].operation, "recordVelocity");
  assertEquals(plan.steps[1].params.itemId, "16");
  const params = plan.steps[1].params as { itemId: string; velocity: VelocityMetrics };
  assertEquals(params.velocity.sprintNumber, 16);
  assertEquals(params.velocity.totalWeight, 21);
});

/**
 * @description 負の sprintNumber で recordVelocity が例外を投げること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_velocity - recordVelocity throws for invalid sprintNumber", () => {
  const identifier = sprintRef(16, "node-id", "16");
  assertThrows(
    () => sprintUseCase.recordVelocity(identifier, { ...VELOCITY, sprintNumber: 0 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 範囲外 matchRate で recordVelocity が例外を投げること
 * @verify Domain 層で matchRate 検証が機能すること
 */
Deno.test("record_sprint_velocity - recordVelocity throws for out-of-range matchRate", () => {
  const identifier = sprintRef(16, "node-id", "16");
  assertThrows(
    () =>
      sprintUseCase.recordVelocity(identifier, { ...VELOCITY, sprintNumber: 16, matchRate: 1.5 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が正しい velocity を受け付けること
 * @verify 例外が発生しないこと
 */
Deno.test("record_sprint_velocity - validateInput accepts valid velocity", () => {
  validateInput({ velocity: VELOCITY });
});

/**
 * @description validateInput が negative pbiCount を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_velocity - validateInput rejects negative pbiCount", () => {
  assertThrows(
    () => validateInput({ velocity: { ...VELOCITY, pbiCount: -1 } }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が範囲外 matchRate を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_velocity - validateInput rejects out-of-range matchRate", () => {
  assertThrows(
    () => validateInput({ velocity: { ...VELOCITY, matchRate: 1.2 } }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が空 summary を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_velocity - validateInput rejects empty summary", () => {
  assertThrows(
    () => validateInput({ velocity: { ...VELOCITY, summary: "" } }),
    Error,
    "INVALID_INPUT",
  );
});
