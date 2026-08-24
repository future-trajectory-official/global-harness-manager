import { assertEquals, assertThrows } from "@std/assert";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { identify, sprintId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { validateInput } from "./plan_retrospective.ts";

/**
 * @description plan が正しい Plan（Retrospective plan操作）を生成すること
 * @verify step数=2、operation が "plan"、title/body/sprint が反映されること
 */
Deno.test("plan_retrospective - plan operation builds correct plan", () => {
  const scope = { owner: "future-trajectory-official", repository: "global-harness-manager" };
  const sprint = sprintId(scope, 20);
  const identifier = identify(scope, "Sprint 20 Retrospective");
  const plan = retrospectiveUseCase.plan(identifier, sprint) as Plan;
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].entity, "Retrospective");
  assertEquals(plan.steps[1].operation, "plan");
  const params = plan.steps[1].params as { title: string; body: string; sprint: string };
  assertEquals(params.title, "Sprint 20 Retrospective");
  assertEquals(params.body, "");
  assertEquals(params.sprint, "Sprint 20");
});

/**
 * @description validateInput が正しい sprintNumber を受け付けること
 * @verify 例外が発生しないこと
 */
Deno.test("plan_retrospective - validateInput accepts valid sprintNumber", () => {
  validateInput({ sprintNumber: 20 });
});

/**
 * @description validateInput が非正の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("plan_retrospective - validateInput rejects non-positive sprintNumber", () => {
  assertThrows(
    () => validateInput({ sprintNumber: 0 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が小数の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("plan_retrospective - validateInput rejects non-integer sprintNumber", () => {
  assertThrows(
    () => validateInput({ sprintNumber: 20.5 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が欠落入力（sprintNumber無し）を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("plan_retrospective - validateInput rejects missing sprintNumber", () => {
  assertThrows(
    () => validateInput({} as { sprintNumber: number }),
    Error,
    "INVALID_INPUT",
  );
});
