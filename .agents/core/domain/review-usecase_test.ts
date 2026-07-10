import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import type {
  AcceptanceCriterias,
  ChangeReason,
  ReviewIdentifier,
  SprintIdentifier,
} from "./types.ts";
import { reviewUseCase } from "./review-usecase.ts";
import type { ReviewData } from "./types.ts";
import type { ReviewPlanInput } from "./review-usecase.ts";

function makeIdentifier(overrides?: Partial<ReviewIdentifier>): ReviewIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 15 Review" },
    id: "review-1",
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

function makePlanInput(overrides?: Partial<ReviewPlanInput>): ReviewPlanInput {
  return {
    pbis: [
      {
        number: 1,
        title: "PBIタイトル",
        wps: [
          {
            number: 1,
            title: "WPタイトル",
            acs: [
              { number: "1", description: "AC1の説明", verificationPlan: "dry-runでPlanを確認" },
              { number: "2", description: "AC2の説明" },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeReason(description = "Updated review scope"): ChangeReason {
  return { description };
}

function makeRemovedACs(): AcceptanceCriterias {
  return {
    items: [
      { number: "1", description: "Old AC", judgment: "removed" },
    ],
  };
}

function makeAddedACs(): AcceptanceCriterias {
  return {
    items: [
      { number: "2", description: "New AC", judgment: "unchecked" },
    ],
  };
}

function makeReviewData(overrides?: Partial<ReviewData>): ReviewData {
  return {
    identifier: makeIdentifier(),
    statement: { environment: "staging" },
    sprint: makeSprint(),
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
      },
    ],
    state: "open",
    ...overrides,
  };
}

Deno.test("reviewUseCase - plan should return Plan with plan step", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  assertEquals(plan.summary, "Plan review: Sprint 15 Review");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "plan");
  assertEquals(plan.steps[1].params.sprint, "Sprint 15");
});

Deno.test("reviewUseCase - plan body should include all ACs as ❔ unchecked", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "Sprint 15");
  assertStringIncludes(body, "❔");
  assertStringIncludes(body, "AC_1: AC1の説明");
  assertStringIncludes(body, "AC_2: AC2の説明");
  assertStringIncludes(body, "PBIタイトル");
  assertStringIncludes(body, "WPタイトル");
  assertStringIncludes(body, "dry-runでPlanを確認");
});

Deno.test("reviewUseCase - plan body should include legend", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "凡例");
  assertStringIncludes(body, "✅ 合格");
  assertStringIncludes(body, "❌ 不合格");
  assertStringIncludes(body, "➖ 論理削除");
});

Deno.test("reviewUseCase - plan body should include sprintGoal when provided", () => {
  const planInput = makePlanInput({ sprintGoal: "ゴール内容" });
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), planInput);
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "## スプリントゴール");
  assertStringIncludes(body, "ゴール内容");
});

Deno.test("reviewUseCase - plan body should include PBI/WP summary when provided", () => {
  const planInput = makePlanInput({
    pbis: [
      {
        number: 1,
        title: "PBIタイトル",
        summary: "PBI概要",
        wps: [
          {
            number: 1,
            title: "WPタイトル",
            summary: "WP概要",
            acs: [{ number: "1", description: "AC1" }],
          },
        ],
      },
    ],
  });
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), planInput);
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "PBI概要");
  assertStringIncludes(body, "WP概要");
});

Deno.test("reviewUseCase - plan body should not include sprint goal / summary when absent", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  const body = plan.steps[1].params.body as string;
  assertEquals(body.includes("## スプリントゴール"), false);
  assertEquals(body.includes("**概要**"), false);
});

Deno.test("reviewUseCase - plan should throw for empty title", () => {
  assertThrows(
    () =>
      reviewUseCase.plan(makeIdentifier({ title: { value: "" } }), makeSprint(), makePlanInput()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - plan should throw for empty sprint title", () => {
  assertThrows(
    () =>
      reviewUseCase.plan(makeIdentifier(), makeSprint({ title: { value: "" } }), makePlanInput()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - revise should return Plan with two update steps", () => {
  const plan = reviewUseCase.revise(
    makeIdentifier(),
    makeRemovedACs(),
    makeAddedACs(),
    makeReason(),
  );
  assertEquals(plan.summary, "Revise review: Sprint 15 Review");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "revise");
});

Deno.test("reviewUseCase - revise should throw for undefined id", () => {
  assertThrows(
    () =>
      reviewUseCase.revise(
        makeIdentifier({ id: undefined }),
        undefined,
        undefined,
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - revise should throw for empty reason", () => {
  assertThrows(
    () =>
      reviewUseCase.revise(
        makeIdentifier(),
        undefined,
        undefined,
        makeReason(""),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - report should return Plan with report step", () => {
  const data = makeReviewData({
    overallResult: { judgment: "pass", reason: "All ACs satisfied" },
    postPlanAcGroups: [{
      pbiNumber: 1,
      wpNumber: "1",
      acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
    }],
  });
  const plan = reviewUseCase.report(data);
  assertEquals(plan.summary, "Report review: Sprint 15 Review");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "report");
  const overallResult = plan.steps[1].params.overallResult as { judgment: string } | undefined;
  assertEquals(overallResult?.judgment, "pass");
});

Deno.test("reviewUseCase - report should throw for undefined id", () => {
  assertThrows(
    () => reviewUseCase.report(makeReviewData({ identifier: makeIdentifier({ id: undefined }) })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - archive should return Plan with archive + update steps", () => {
  const plan = reviewUseCase.archive(makeIdentifier());
  assertEquals(plan.summary, "Archive review: Sprint 15 Review");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "archive");
  assertEquals(plan.steps[2].operation, "update");
});

Deno.test("reviewUseCase - archive should throw for undefined id", () => {
  assertThrows(
    () => reviewUseCase.archive(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - find should return Plan with view step", () => {
  const plan = reviewUseCase.find(makeIdentifier());
  assertEquals(plan.summary, "Find review: Sprint 15 Review");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
});

Deno.test("reviewUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => reviewUseCase.find(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("reviewUseCase - search should delegate to condition.describe", () => {
  const condition = {
    sprintNumber: 15,
    describe: () => ({ summary: "Search reviews", steps: [] }),
  };
  const plan = reviewUseCase.search(condition);
  assertEquals(plan.summary, "Search reviews");
});
