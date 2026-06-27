import { assertEquals, assertThrows } from "@std/assert";
import type {
  ChangeReason,
  KeepProblemTryAdvice,
  RetrospectiveIdentifier,
  SprintIdentifier,
  SprintMetrics,
} from "./types.ts";
import { retrospectiveUseCase } from "./retrospective-usecase.ts";

function makeIdentifier(overrides?: Partial<RetrospectiveIdentifier>): RetrospectiveIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 15 Retrospective" },
    id: "retro-1",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeSprint(overrides?: Partial<SprintIdentifier>): SprintIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 15" },
    id: "sprint-15",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeKpta(overrides?: Partial<KeepProblemTryAdvice>): KeepProblemTryAdvice {
  return {
    keep: "Good communication",
    problem: "Context loss on handoff",
    try: "Document decisions",
    advise: "Use ADR for major decisions",
    ...overrides,
  };
}

function makeMetrics(overrides?: Partial<SprintMetrics>): SprintMetrics {
  return {
    goalAchievementRate: 80,
    estimationAccuracy: 75,
    qualityIntegrity: 90,
    collaborationDiscipline: 85,
    velocity: 6,
    ...overrides,
  };
}

function makeReason(description = "Completed retrospective"): ChangeReason {
  return { description };
}

Deno.test("retrospectiveUseCase - plan should return Plan with createItem + addComment", () => {
  const plan = retrospectiveUseCase.plan(makeIdentifier(), makeSprint());
  assertEquals(plan.summary, "Plan retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "createItem");
  assertEquals(plan.steps[0].params.type, "Retrospective");
  assertEquals(plan.steps[1].operation, "addComment");
});

Deno.test("retrospectiveUseCase - plan should throw for empty title", () => {
  assertThrows(
    () => retrospectiveUseCase.plan(makeIdentifier({ title: { value: "" } }), makeSprint()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - execute should return Plan with updateItem + editComment", () => {
  const plan = retrospectiveUseCase.execute(
    makeIdentifier(),
    makeKpta(),
    makeMetrics(),
    makeReason(),
  );
  assertEquals(plan.summary, "Execute retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[1].operation, "editComment");
});

Deno.test("retrospectiveUseCase - execute should throw for undefined id", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.execute(
        makeIdentifier({ id: undefined }),
        makeKpta(),
        makeMetrics(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - execute should throw for empty kpta keep", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.execute(
        makeIdentifier(),
        makeKpta({ keep: "" }),
        makeMetrics(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - execute should throw for empty kpta problem", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.execute(
        makeIdentifier(),
        makeKpta({ problem: "" }),
        makeMetrics(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - execute should throw for empty kpta try", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.execute(
        makeIdentifier(),
        makeKpta({ try: "" }),
        makeMetrics(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - execute should throw for empty kpta advise", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.execute(
        makeIdentifier(),
        makeKpta({ keep: "" }),
        makeMetrics(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - archive should return Plan with closeItem + editComment", () => {
  const plan = retrospectiveUseCase.archive(makeIdentifier());
  assertEquals(plan.summary, "Archive retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "closeItem");
  assertEquals(plan.steps[1].operation, "editComment");
});

Deno.test("retrospectiveUseCase - archive should throw for undefined id", () => {
  assertThrows(
    () => retrospectiveUseCase.archive(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - find should return Plan with findItem step", () => {
  const plan = retrospectiveUseCase.find(makeIdentifier());
  assertEquals(plan.summary, "Find retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps[0].operation, "findItem");
});

Deno.test("retrospectiveUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => retrospectiveUseCase.find(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - search should delegate to condition.describe", () => {
  const condition = {
    sprintNumber: 15,
    describe: () => ({ summary: "Search retrospectives", steps: [] }),
  };
  const plan = retrospectiveUseCase.search(condition);
  assertEquals(plan.summary, "Search retrospectives");
});
