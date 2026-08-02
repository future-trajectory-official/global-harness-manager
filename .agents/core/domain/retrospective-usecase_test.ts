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

Deno.test("retrospectiveUseCase - plan should return Plan with plan + execute", () => {
  const plan = retrospectiveUseCase.plan(makeIdentifier(), makeSprint());
  assertEquals(plan.summary, "Plan retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "plan");
  assertEquals(plan.steps[1].params.body, "## Sprint Retrospective\n\n- **Sprint**: Sprint 15");
  assertEquals(plan.steps[2].operation, "execute");
});

Deno.test("retrospectiveUseCase - plan should throw for empty title", () => {
  assertThrows(
    () => retrospectiveUseCase.plan(makeIdentifier({ title: { value: "" } }), makeSprint()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - execute should return Plan with execute + execute", () => {
  const plan = retrospectiveUseCase.execute(
    makeIdentifier(),
    makeKpta(),
    makeMetrics(),
    makeReason(),
  );
  assertEquals(plan.summary, "Execute retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "execute");
  assertEquals(plan.steps[2].operation, "execute");
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

Deno.test("retrospectiveUseCase - archive should return Plan with archive + archive", () => {
  const plan = retrospectiveUseCase.archive(makeIdentifier());
  assertEquals(plan.summary, "Archive retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "archive");
  assertEquals(plan.steps[2].operation, "archive");
});

Deno.test("retrospectiveUseCase - archive should throw for undefined id", () => {
  assertThrows(
    () => retrospectiveUseCase.archive(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - find should return Plan with view step", () => {
  const plan = retrospectiveUseCase.find(makeIdentifier());
  assertEquals(plan.summary, "Find retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
});

/**
 * find の正常系（codeのみ）。id が undefined でも code があれば Plan が返ることを確認する。
 * @description read-project-state スキルは Issue 番号（code）を主キーに find を呼ぶため、id 無しで成立すること
 * @verify code="42" を保持したまま find が Plan を返し、view 操作を含むこと
 */
Deno.test("retrospectiveUseCase - find should succeed with code even if id is undefined", () => {
  const plan = retrospectiveUseCase.find(makeIdentifier({ id: undefined, code: "42" }));
  assertEquals(plan.summary, "Find retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
  assertEquals(plan.steps[1].params.itemId, "42");
});

/**
 * find の異常系。id と code の両方が undefined の場合にエラーがスローされることを確認する。
 * @description 参照識別子（id/code）が完全に欠落している場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("retrospectiveUseCase - find should throw when both id and code are undefined", () => {
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
