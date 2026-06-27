import { assertEquals, assertThrows } from "@std/assert";
import type { GoalStatement, SprintIdentifier } from "./types.ts";
import { sprintId } from "./types.ts";
import { sprintUseCase } from "./sprint-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makeId(): SprintIdentifier {
  return sprintId(scope, 16, "sprint-16");
}

function makeGoal(description = "Complete Domain layer implementation"): GoalStatement {
  return { description };
}

Deno.test("sprintUseCase - start should return Plan with createTimebox operation", () => {
  const plan = sprintUseCase.start(sprintId(scope, 16));
  assertEquals(plan.summary, "Start sprint: Sprint 16");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "createTimebox");
  assertEquals(plan.steps[0].params.title, "Sprint 16");
});

Deno.test("sprintUseCase - end should return Plan with closeTimebox operation", () => {
  const plan = sprintUseCase.end(makeId());
  assertEquals(plan.summary, "End sprint: Sprint 16");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "closeTimebox");
});

Deno.test("sprintUseCase - end should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.end(sprintId(scope, 16)),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - setGoal should return Plan with updateTimebox operation", () => {
  const plan = sprintUseCase.setGoal(makeId(), makeGoal());
  assertEquals(plan.summary, "Set goal for sprint: Sprint 16");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "updateTimebox");
  assertEquals(plan.steps[0].params.description, "Complete Domain layer implementation");
});

Deno.test("sprintUseCase - setGoal should throw for empty goal", () => {
  assertThrows(
    () => sprintUseCase.setGoal(makeId(), makeGoal("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - setGoal should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.setGoal(sprintId(scope, 16), makeGoal()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - setDueDate should return Plan with updateTimebox operation", () => {
  const plan = sprintUseCase.setDueDate(makeId(), new Date("2026-07-10"));
  assertEquals(plan.summary, "Set due date for sprint: Sprint 16");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "updateTimebox");
  assertEquals(plan.steps[0].params.dueDate, "2026-07-10T00:00:00.000Z");
});

Deno.test("sprintUseCase - setDueDate should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.setDueDate(sprintId(scope, 16), new Date()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - find should return Plan with findItem step", () => {
  const plan = sprintUseCase.find(makeId());
  assertEquals(plan.summary, "Find sprint: Sprint 16");
  assertEquals(plan.steps[0].operation, "findItem");
});

Deno.test("sprintUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.find(sprintId(scope, 16)),
    Error,
    "INVALID_INPUT",
  );
});

// ====== sprintId factory tests ======

Deno.test("sprintId - should generate Sprint N format title without id", () => {
  const id = sprintId(scope, 16);
  assertEquals(id.title.value, "Sprint 16");
  assertEquals(id.id, undefined);
});

Deno.test("sprintId - should set id when provided", () => {
  const id = sprintId(scope, 16, "MI_kwA...");
  assertEquals(id.title.value, "Sprint 16");
  assertEquals(id.id, "MI_kwA...");
});

Deno.test("sprintId - should throw for zero", () => {
  assertThrows(
    () => sprintId(scope, 0),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintId - should throw for negative", () => {
  assertThrows(
    () => sprintId(scope, -1),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintId - should throw for non-integer", () => {
  assertThrows(
    () => sprintId(scope, 1.5),
    Error,
    "INVALID_INPUT",
  );
});
