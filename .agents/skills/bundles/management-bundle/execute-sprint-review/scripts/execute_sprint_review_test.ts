import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewData, ReviewIdentifier } from "../../../../../core/domain/types.ts";
import { validateInput } from "./execute_sprint_review.ts";

function makeIdentifier(overrides?: Partial<ReviewIdentifier>): ReviewIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Sprint 17 Review" },
    id: "review-17",
    code: "42",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeReviewData(overrides?: Partial<ReviewData>): ReviewData {
  return {
    identifier: makeIdentifier(),
    statement: { environment: "production" },
    sprint: {
      scope: { owner: "my-org", repository: "my-repo" },
      title: { value: "Sprint 17" },
      id: "sprint-17",
      code: "17",
      describe: () => ({ summary: "describe", steps: [] }),
    },
    plannedAcGroups: [],
    postPlanAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: 1,
        acJudgments: [
          { number: "1", description: "AC1 description", judgment: "pass" },
        ],
      },
    ],
    overallResult: { judgment: "pass", reason: "All ACs satisfied" },
    state: "open",
    ...overrides,
  };
}

Deno.test("execute-sprint-review - report should return Plan with report step", () => {
  const data = makeReviewData();
  const plan = reviewUseCase.report(data);
  assertEquals(plan.summary, "Report review: Sprint 17 Review");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "report");
  const overallResult = plan.steps[0].params.overallResult as { judgment: string };
  assertEquals(overallResult.judgment, "pass");
});

Deno.test("execute-sprint-review - report body should include AC judgments", () => {
  const data = makeReviewData();
  const plan = reviewUseCase.report(data);
  const body = plan.steps[0].params.body as string;
  assertStringIncludes(body, "Overall Result");
  assertStringIncludes(body, "pass");
  assertStringIncludes(body, "Post-Plan AC Results");
  assertStringIncludes(body, "🟢 AC1");
});

Deno.test("execute-sprint-review - report should throw for undefined id", () => {
  assertThrows(
    () =>
      reviewUseCase.report(
        makeReviewData({ identifier: makeIdentifier({ id: undefined as unknown as string }) }),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("execute-sprint-review - report should include multiple AC groups", () => {
  const data = makeReviewData({
    postPlanAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: 1,
        acJudgments: [
          { number: "1", description: "AC1", judgment: "pass" },
          { number: "2", description: "AC2", judgment: "fail" },
        ],
      },
      {
        pbiNumber: 2,
        wpNumber: 1,
        acJudgments: [
          { number: "1", description: "AC3", judgment: "conditional" },
        ],
      },
    ],
  });
  const plan = reviewUseCase.report(data);
  const body = plan.steps[0].params.body as string;
  assertStringIncludes(body, "AC1");
  assertStringIncludes(body, "AC2");
});

Deno.test("execute-sprint-review - search should delegate to condition.describe", () => {
  const condition = {
    sprintNumber: 17,
    describe: () => ({ summary: "Search reviews for Sprint 17", steps: [] }),
  };
  const plan = reviewUseCase.search(condition);
  assertEquals(plan.summary, "Search reviews for Sprint 17");
});

Deno.test("execute-sprint-review - dry-run output should contain Plan structure", () => {
  const data = makeReviewData();
  const plan = reviewUseCase.report(data);
  const output = JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2);
  assertStringIncludes(output, "Report review:");
  assertStringIncludes(output, "report");
  assertStringIncludes(output, "overallResult");
});

Deno.test("execute-sprint-review - report should handle conditional judgment", () => {
  const data = makeReviewData({
    overallResult: { judgment: "conditional", reason: "Minor issues found" },
  });
  const plan = reviewUseCase.report(data);
  const result = plan.steps[0].params.overallResult as { judgment: string; reason: string };
  assertEquals(result.judgment, "conditional");
  assertEquals(result.reason, "Minor issues found");
});

Deno.test("execute-sprint-review - find should return Plan with view step", () => {
  const identifier = makeReviewData().identifier;
  const plan = reviewUseCase.find(identifier);
  assertEquals(plan.summary, "Find review: Sprint 17 Review");
  assertEquals(plan.steps[0].operation, "view");
});

Deno.test("execute-sprint-review - validateInput should throw for missing sprintNumber", () => {
  assertThrows(
    () => validateInput({} as unknown as Parameters<typeof validateInput>[0]),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("execute-sprint-review - validateInput should throw for negative sprintNumber", () => {
  assertThrows(
    () => validateInput({ sprintNumber: -1 } as unknown as Parameters<typeof validateInput>[0]),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("execute-sprint-review - validateInput should throw for missing overallResult", () => {
  assertThrows(
    () => validateInput({ sprintNumber: 17 } as unknown as Parameters<typeof validateInput>[0]),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("execute-sprint-review - validateInput should throw for invalid judgment", () => {
  assertThrows(
    () =>
      validateInput(
        { sprintNumber: 17, overallResult: { judgment: "invalid" } } as unknown as Parameters<
          typeof validateInput
        >[0],
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("execute-sprint-review - validateInput should accept valid input", () => {
  validateInput({
    sprintNumber: 17,
    overallResult: { judgment: "pass", reason: "OK" },
    acGroups: [],
  });
});
