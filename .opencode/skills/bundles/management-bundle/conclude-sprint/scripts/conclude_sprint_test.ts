import { assertEquals, assertThrows } from "@std/assert";
import { sprintId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

Deno.test("conclude_sprint - end should call sprintUseCase.end", () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  const plan = sprintUseCase.end(identifier) as Plan;
  assertEquals(plan.summary, "End sprint: Sprint 18");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "endSprint");
});

Deno.test("conclude_sprint - end should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.end(sprintId(scope, 18)),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("conclude_sprint - end should include milestone number in params", () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  const plan = sprintUseCase.end(identifier) as Plan;
  assertEquals(plan.steps[1].params.itemId, "18");
  assertEquals(plan.steps[1].params.title, "Sprint 18");
});
