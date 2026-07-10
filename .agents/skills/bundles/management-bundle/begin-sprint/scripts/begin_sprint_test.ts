import { assertEquals, assertThrows } from "@std/assert";
import { sprintId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

Deno.test("begin_sprint - start without goal should call sprintUseCase.start", () => {
  const identifier = sprintId(scope, 18);
  const plan = sprintUseCase.start(identifier) as Plan;
  assertEquals(plan.summary, "Start sprint: Sprint 18");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "create");
});

Deno.test("begin_sprint - with goal should call sprintUseCase.setGoal", () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  const plan = sprintUseCase.setGoal(identifier, { description: "Complete Q2 features" }) as Plan;
  assertEquals(plan.summary, "Set goal for sprint: Sprint 18");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "setGoal");
  assertEquals(plan.steps[1].params.description, "Complete Q2 features");
});

Deno.test("begin_sprint - setGoal should throw for empty goal", () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  assertThrows(
    () => sprintUseCase.setGoal(identifier, { description: "" }),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("begin_sprint - start should work without milestone id", () => {
  const identifier = sprintId(scope, 19);
  const plan = sprintUseCase.start(identifier) as Plan;
  assertEquals(plan.steps[1].params.title, "Sprint 19");
});
