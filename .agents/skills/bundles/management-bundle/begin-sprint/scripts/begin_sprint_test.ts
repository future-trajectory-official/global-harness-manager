import { assertEquals, assertRejects } from "@std/assert";
import { sprintId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

Deno.test("begin_sprint - start without goal should call sprintUseCase.start", async () => {
  const identifier = sprintId(scope, 18);
  const plan = await sprintUseCase.start(identifier, { dryRun: true }) as Plan;
  assertEquals(plan.summary, "Start sprint: Sprint 18");
  assertEquals(plan.steps[0].operation, "create");
});

Deno.test("begin_sprint - with goal should call sprintUseCase.setGoal", async () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  const plan = await sprintUseCase.setGoal(identifier, { description: "Complete Q2 features" }, {
    dryRun: true,
  }) as Plan;
  assertEquals(plan.summary, "Set goal for sprint: Sprint 18");
  assertEquals(plan.steps[0].operation, "setGoal");
  assertEquals(plan.steps[0].params.description, "Complete Q2 features");
});

Deno.test("begin_sprint - setGoal should throw for empty goal", async () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  await assertRejects(
    async () => await sprintUseCase.setGoal(identifier, { description: "" }, { dryRun: true }),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("begin_sprint - start should work without milestone id", async () => {
  const identifier = sprintId(scope, 19);
  const plan = await sprintUseCase.start(identifier, { dryRun: true }) as Plan;
  assertEquals(plan.steps[0].params.title, "Sprint 19");
});
