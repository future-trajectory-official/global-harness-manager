import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewPlanInput } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewIdentifier, SprintIdentifier } from "../../../../../core/domain/types.ts";

function makeIdentifier(overrides?: Partial<ReviewIdentifier>): ReviewIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 15 Review" },
    id: "review-1",
    code: "42",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeSprint(overrides?: Partial<SprintIdentifier>): SprintIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 15" },
    id: "sprint-15",
    code: "15",
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
              { number: "1", description: "AC1の説明", verificationPlan: "dry-runで確認" },
              { number: "2", description: "AC2の説明" },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

Deno.test("plan-sprint-review - plan should return Plan with plan + update steps", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  assertEquals(plan.summary, "Plan review: Sprint 15 Review");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Review");
  assertEquals(plan.steps[0].operation, "plan");
  assertEquals(plan.steps[0].params.title, "Sprint 15 Review");
  assertEquals(plan.steps[0].params.sprint, "Sprint 15");
  assertStringIncludes(plan.steps[0].params.body as string, "Sprint 15");
  assertEquals(plan.steps[1].entity, "Review");
  assertEquals(plan.steps[1].operation, "update");
});

Deno.test("plan-sprint-review - plan body should list all ACs as unchecked", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  const body = plan.steps[0].params.body as string;
  assertStringIncludes(body, "❔");
  assertStringIncludes(body, "AC_1: AC1の説明");
  assertStringIncludes(body, "AC_2: AC2の説明");
  assertStringIncludes(body, "PBIタイトル");
  assertStringIncludes(body, "WPタイトル");
  assertStringIncludes(body, "dry-runで確認");
  assertStringIncludes(body, "凡例");
  assertStringIncludes(body, "✅ 合格");
});

Deno.test("plan-sprint-review - plan should include sprint info in body", () => {
  const sprint = makeSprint({ title: { value: "Sprint 17" } });
  const plan = reviewUseCase.plan(makeIdentifier(), sprint, makePlanInput());
  assertStringIncludes(plan.steps[0].params.body as string, "Sprint 17");
});

Deno.test("plan-sprint-review - plan should throw for empty review title", () => {
  assertThrows(
    () =>
      reviewUseCase.plan(makeIdentifier({ title: { value: "" } }), makeSprint(), makePlanInput()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("plan-sprint-review - plan should throw for empty sprint title", () => {
  assertThrows(
    () =>
      reviewUseCase.plan(makeIdentifier(), makeSprint({ title: { value: "" } }), makePlanInput()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("plan-sprint-review - plan should accept custom review title", () => {
  const plan = reviewUseCase.plan(
    makeIdentifier({ title: { value: "Custom Review Title" } }),
    makeSprint(),
    makePlanInput(),
  );
  assertEquals(plan.summary, "Plan review: Custom Review Title");
});

Deno.test("plan-sprint-review - dry-run output should contain Plan structure", () => {
  const plan = reviewUseCase.plan(makeIdentifier(), makeSprint(), makePlanInput());
  const output = JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2);
  assertStringIncludes(output, "Plan review:");
  assertStringIncludes(output, "Review");
  assertStringIncludes(output, "plan");
});
