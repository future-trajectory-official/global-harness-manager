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
    summary: {
      goalAchievementScore: 4,
      estimationAccuracyScore: 3,
      qualityIntegrityScore: 5,
      collaborationDisciplineScore: 4,
      velocity: 6,
    },
    goalAchievement: "Goals largely achieved",
    estimationAccuracy: "Estimation slightly off",
    qualityIntegrity: "Quality maintained",
    collaborationDiscipline: "Discipline well followed",
    velocity: "Velocity stable with minor variance",
    ...overrides,
  };
}

function makeReason(description = "Completed retrospective"): ChangeReason {
  return { description };
}

Deno.test("retrospectiveUseCase - plan should return Plan with plan", () => {
  const plan = retrospectiveUseCase.plan(makeIdentifier(), makeSprint());
  assertEquals(plan.summary, "Plan retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "plan");
  assertEquals(plan.steps[1].params.body, "");
  assertEquals(plan.steps[1].params.sprint, "Sprint 15");
});

Deno.test("retrospectiveUseCase - plan should throw for empty title", () => {
  assertThrows(
    () => retrospectiveUseCase.plan(makeIdentifier({ title: { value: "" } }), makeSprint()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintKpt should return Plan with recordSprintKpt step", () => {
  const plan = retrospectiveUseCase.recordSprintKpt(
    makeIdentifier({ code: "retro-1" }),
    makeKpta(),
    makeReason(),
  );
  assertEquals(plan.summary, "Record Sprint KPT: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "recordSprintKpt");
  assertEquals(plan.steps[1].params.itemId, "retro-1");
  const kpta = plan.steps[1].params.kpta as KeepProblemTryAdvice;
  assertEquals(kpta.keep, "Good communication");
  assertEquals(kpta.problem, "Context loss on handoff");
  assertEquals(kpta.try, "Document decisions");
  assertEquals(kpta.advise, "Use ADR for major decisions");
  const body = plan.steps[1].params.body as string;
  assertEquals(body.includes("## KPTA"), true);
  assertEquals(body.includes("### Keep\nGood communication"), true);
  assertEquals(body.includes("### Problem\nContext loss on handoff"), true);
  assertEquals(body.includes("### Try\nDocument decisions"), true);
  assertEquals(body.includes("### Advise\nUse ADR for major decisions"), true);
});

Deno.test("retrospectiveUseCase - recordSprintKpt should throw for undefined id", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintKpt(
        makeIdentifier({ id: undefined }),
        makeKpta(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintKpt should throw for empty reason", () => {
  assertThrows(
    () => retrospectiveUseCase.recordSprintKpt(makeIdentifier(), makeKpta(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintKpt should throw for empty kpta keep", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintKpt(makeIdentifier(), makeKpta({ keep: "" }), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintKpt should throw for empty kpta problem", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintKpt(
        makeIdentifier(),
        makeKpta({ problem: "" }),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintKpt should throw for empty kpta try", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintKpt(makeIdentifier(), makeKpta({ try: "" }), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintKpt should throw for empty kpta advise", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintKpt(
        makeIdentifier(),
        makeKpta({ advise: "" }),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintMetrics should return Plan with recordSprintMetrics step", () => {
  const plan = retrospectiveUseCase.recordSprintMetrics(
    makeIdentifier({ code: "retro-1" }),
    makeMetrics(),
    makeReason(),
  );
  assertEquals(plan.summary, "Record Sprint Metrics: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "recordSprintMetrics");
  assertEquals(plan.steps[1].params.itemId, "retro-1");
  const metrics = plan.steps[1].params.metrics as SprintMetrics;
  assertEquals(metrics.summary.goalAchievementScore, 4);
  assertEquals(metrics.summary.velocity, 6);
  assertEquals(metrics.goalAchievement, "Goals largely achieved");
  const body = plan.steps[1].params.body as string;
  assertEquals(body.includes("## Sprint Metrics"), true);
  assertEquals(body.includes("### Goal Achievement Rate"), true);
  assertEquals(body.includes("- score: 4"), true);
  assertEquals(body.includes("- narrative: Goals largely achieved"), true);
  assertEquals(body.includes("### Velocity"), true);
  assertEquals(body.includes("- value: 6"), true);
  assertEquals(body.includes("- narrative: Velocity stable with minor variance"), true);
});

Deno.test("retrospectiveUseCase - recordSprintMetrics should throw for undefined id", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintMetrics(
        makeIdentifier({ id: undefined }),
        makeMetrics(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintMetrics should throw for empty reason", () => {
  assertThrows(
    () => retrospectiveUseCase.recordSprintMetrics(makeIdentifier(), makeMetrics(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintMetrics should throw for empty narrative", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintMetrics(
        makeIdentifier(),
        makeMetrics({ goalAchievement: "" }),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - recordSprintMetrics should throw for negative score", () => {
  assertThrows(
    () =>
      retrospectiveUseCase.recordSprintMetrics(
        makeIdentifier(),
        makeMetrics({ summary: { ...makeMetrics().summary, goalAchievementScore: -1 } }),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("retrospectiveUseCase - archive should return Plan with archive step only", () => {
  const plan = retrospectiveUseCase.archive(makeIdentifier());
  assertEquals(plan.summary, "Archive retrospective: Sprint 15 Retrospective");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "archive");
  assertEquals(plan.steps[1].params.state, "closed");
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
