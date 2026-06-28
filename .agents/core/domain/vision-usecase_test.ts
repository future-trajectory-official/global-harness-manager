import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import type { Outcomes, VisionIdentifier, VisionStatement } from "./types.ts";
import { formatVisionBody, formatVisionComment, visionUseCase } from "./vision-usecase.ts";
import type { ChangeReason } from "./types.ts";

function makeIdentifier(overrides?: Partial<VisionIdentifier>): VisionIdentifier {
  return {
    scope: { owner: "my-org", repository: "my-repo" },
    title: { value: "Test Vision" },
    id: "vision-1",
    describe: () => ({ summary: "describe", steps: [] }),
    ...overrides,
  };
}

function makeStatement(overrides?: Partial<VisionStatement>): VisionStatement {
  return {
    targetAudience: "AIを活用した開発初心者",
    value: "クローンするだけで環境が整う",
    differentiator: "教育的協働で成長させる",
    ...overrides,
  };
}

function makeOutcomes(): Outcomes {
  return { items: [{ title: "Zero-setup", description: "クローンするだけで環境が整う" }] };
}

function makeReason(description = "Strategy change"): ChangeReason {
  return { description };
}

Deno.test("visionUseCase - establish should return Plan with createItem + addComment", () => {
  const plan = visionUseCase.establish(makeIdentifier(), makeStatement(), makeOutcomes());
  assertEquals(plan.summary, "Establish vision: Test Vision");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "createItem");
  assertEquals(plan.steps[0].params.title, "Test Vision");
  assertEquals(plan.steps[0].params.type, "Vision");
  assertEquals(plan.steps[1].operation, "addComment");
});

Deno.test("visionUseCase - establish body should be history table (L2 spec)", () => {
  const plan = visionUseCase.establish(makeIdentifier(), makeStatement(), makeOutcomes());
  const body = plan.steps[0].params.body as string;
  assertStringIncludes(body, "## History");
  assertStringIncludes(body, "| 日付 | バージョン | 概要 |");
  assertStringIncludes(body, "| 1 |");
});

Deno.test("visionUseCase - establish comment should be versioned content (L2 spec)", () => {
  const plan = visionUseCase.establish(makeIdentifier(), makeStatement(), makeOutcomes());
  const comment = plan.steps[1].params.body as string;
  assertStringIncludes(comment, "# Version: 1");
  assertStringIncludes(comment, "## Statement");
  assertStringIncludes(comment, "### Target");
  assertStringIncludes(comment, "### Value");
  assertStringIncludes(comment, "### Differentiator");
  assertStringIncludes(comment, "## Outcome");
  assertStringIncludes(comment, "### Zero-setup");
});

Deno.test("visionUseCase - establish should throw for empty title", () => {
  assertThrows(
    () =>
      visionUseCase.establish(
        makeIdentifier({ title: { value: "" } }),
        makeStatement(),
        makeOutcomes(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("visionUseCase - establish should throw for missing statement fields", () => {
  assertThrows(
    () =>
      visionUseCase.establish(
        makeIdentifier(),
        makeStatement({ targetAudience: "" }),
        makeOutcomes(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("visionUseCase - pivot should return Plan with updateItem + addComment", () => {
  const plan = visionUseCase.pivot(makeIdentifier(), makeStatement(), makeOutcomes(), makeReason());
  assertEquals(plan.summary, "Pivot vision: Test Vision");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertStringIncludes(plan.steps[0].params.bodyAppend as string, "| 2 | Strategy change |");
  assertEquals(plan.steps[1].operation, "addComment");
});

Deno.test("visionUseCase - pivot comment should have version 2", () => {
  const plan = visionUseCase.pivot(makeIdentifier(), makeStatement(), makeOutcomes(), makeReason());
  const comment = plan.steps[1].params.body as string;
  assertStringIncludes(comment, "# Version: 2");
});

Deno.test("visionUseCase - pivot should throw for empty reason", () => {
  assertThrows(
    () => visionUseCase.pivot(makeIdentifier(), makeStatement(), makeOutcomes(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("visionUseCase - pivot should throw for undefined id", () => {
  assertThrows(
    () =>
      visionUseCase.pivot(
        makeIdentifier({ id: undefined }),
        makeStatement(),
        makeOutcomes(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("visionUseCase - find should return Plan with findItem step", () => {
  const plan = visionUseCase.find(makeIdentifier());
  assertEquals(plan.summary, "Find vision: Test Vision");
  assertEquals(plan.steps[0].operation, "findItem");
});

Deno.test("visionUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => visionUseCase.find(makeIdentifier({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("visionUseCase - find should throw for empty title", () => {
  assertThrows(
    () => visionUseCase.find(makeIdentifier({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("formatVisionComment - should generate L2-compliant comment body", () => {
  const comment = formatVisionComment(makeStatement(), makeOutcomes(), 1);
  assertStringIncludes(comment, "# Version: 1");
  assertStringIncludes(comment, "### Target\n\nAIを活用した開発初心者");
  assertStringIncludes(comment, "### Value\n\nクローンするだけで環境が整う");
  assertStringIncludes(comment, "### Differentiator\n\n教育的協働で成長させる");
  assertStringIncludes(comment, "### Zero-setup\n\nクローンするだけで環境が整う");
});

Deno.test("formatVisionBody - should generate history table with initial entry", () => {
  const body = formatVisionBody();
  assertStringIncludes(body, "## History");
  assertStringIncludes(body, "| 日付 | バージョン | 概要 |");
  assertStringIncludes(body, "| 1 | プロジェクト開始 |");
});
