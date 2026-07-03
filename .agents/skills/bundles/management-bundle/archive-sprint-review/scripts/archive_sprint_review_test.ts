import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewIdentifier } from "../../../../../core/domain/types.ts";

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

Deno.test("archive-sprint-review - archive should return Plan with archive + update steps", () => {
  const plan = reviewUseCase.archive(makeIdentifier());
  assertEquals(plan.summary, "Archive review: Sprint 15 Review");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Review");
  assertEquals(plan.steps[0].operation, "archive");
  assertEquals(plan.steps[1].entity, "Review");
  assertEquals(plan.steps[1].operation, "update");
});

Deno.test("archive-sprint-review - archive should close with correct params", () => {
  const plan = reviewUseCase.archive(makeIdentifier());
  assertEquals(plan.steps[0].params.itemId, "42");
  assertEquals(plan.steps[0].params.state, "closed");
});

Deno.test("archive-sprint-review - archive should add archive comment via update step", () => {
  const plan = reviewUseCase.archive(makeIdentifier());
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "Archived");
  assertStringIncludes(body, "Sprint 15 Review");
});

Deno.test("archive-sprint-review - archive should throw for undefined id", () => {
  assertThrows(
    () => reviewUseCase.archive(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("archive-sprint-review - archive should throw for empty title", () => {
  assertThrows(
    () => reviewUseCase.archive(makeIdentifier({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("archive-sprint-review - archive dry-run output should contain Plan structure", () => {
  const plan = reviewUseCase.archive(makeIdentifier());
  const output = JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2);
  assertStringIncludes(output, "Archive review:");
  assertStringIncludes(output, "archive");
  assertStringIncludes(output, "update");
});
