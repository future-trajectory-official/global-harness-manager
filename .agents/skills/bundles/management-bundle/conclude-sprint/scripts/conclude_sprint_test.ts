import { assertEquals, assertRejects } from "@std/assert";
import { sprintId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

Deno.test("conclude_sprint - end should call sprintUseCase.end", async () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  const plan = await sprintUseCase.end(identifier, { dryRun: true }) as Plan;
  assertEquals(plan.summary, "End sprint: Sprint 18");
  assertEquals(plan.steps[0].operation, "endSprint");
});

Deno.test("conclude_sprint - end should throw for undefined id", async () => {
  await assertRejects(
    async () => await sprintUseCase.end(sprintId(scope, 18), { dryRun: true }),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("conclude_sprint - end should include milestone number in params", async () => {
  const identifier = sprintId(scope, 18, "milestone-18", "18");
  const plan = await sprintUseCase.end(identifier, { dryRun: true }) as Plan;
  assertEquals(plan.steps[0].params.itemId, "18");
  assertEquals(plan.steps[0].params.title, "Sprint 18");
});
