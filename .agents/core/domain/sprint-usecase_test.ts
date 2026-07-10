import { assertEquals, assertThrows } from "@std/assert";
import type { Plan } from "./types.ts";
import type { GoalStatement, SprintIdentifier } from "./types.ts";
import { sprintId } from "./types.ts";
import { sprintUseCase } from "./sprint-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makeId(): SprintIdentifier {
  return sprintId(scope, 16, "sprint-16", "16");
}

function makeGoal(description = "Complete Domain layer implementation"): GoalStatement {
  return { description };
}

Deno.test("sprintUseCase - start should return Plan with Scope.resolve + create operation", () => {
  const plan = sprintUseCase.start(sprintId(scope, 16)) as Plan;
  assertEquals(plan.summary, "Start sprint: Sprint 16");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "create");
  assertEquals(plan.steps[1].params.title, "Sprint 16");
});

Deno.test("sprintUseCase - end should return Plan with Scope.resolve + endSprint operation", () => {
  const plan = sprintUseCase.end(makeId()) as Plan;
  assertEquals(plan.summary, "End sprint: Sprint 16");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "endSprint");
});

Deno.test("sprintUseCase - end should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.end(sprintId(scope, 16)),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - setGoal should return Plan with Scope.resolve + setGoal operation", () => {
  const plan = sprintUseCase.setGoal(makeId(), makeGoal()) as Plan;
  assertEquals(plan.summary, "Set goal for sprint: Sprint 16");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "setGoal");
  assertEquals(plan.steps[1].params.description, "Complete Domain layer implementation");
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

Deno.test("sprintUseCase - setDueDate should return Plan with Scope.resolve + setDueDate operation", () => {
  const plan = sprintUseCase.setDueDate(makeId(), new Date("2026-07-10")) as Plan;
  assertEquals(plan.summary, "Set due date for sprint: Sprint 16");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "setDueDate");
  assertEquals(plan.steps[1].params.dueDate, "2026-07-10T00:00:00.000Z");
});

Deno.test("sprintUseCase - setDueDate should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.setDueDate(sprintId(scope, 16), new Date()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - find should return Plan with Scope.resolve + view operation", () => {
  const plan = sprintUseCase.find(makeId()) as Plan;
  assertEquals(plan.summary, "Find sprint: Sprint 16");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "view");
});

Deno.test("sprintUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => sprintUseCase.find(sprintId(scope, 16)),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("sprintUseCase - find without args should return Plan with search+view operations", () => {
  const plan = sprintUseCase.find() as Plan;
  assertEquals(plan.summary, "Find latest open sprint");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].entity, "Sprint");
  assertEquals(plan.steps[1].operation, "search");
  assertEquals(plan.steps[1].params.state, "open");
  assertEquals(plan.steps[2].entity, "Sprint");
  assertEquals(plan.steps[2].operation, "view");
  assertEquals(plan.steps[2].params, {});
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
