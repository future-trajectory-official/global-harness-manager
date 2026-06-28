import { assertEquals } from "@std/assert";
import { visionUseCase } from "../../../../core/domain/vision-usecase.ts";
import type { EntityScope, Outcomes, VisionStatement } from "../../../../core/domain/types.ts";
import { identify } from "../../../../core/domain/types.ts";

function makeScope(): EntityScope {
  return { owner: "test-org", repository: "test-repo" };
}

function makeStatement(): VisionStatement {
  return {
    targetAudience: "AI開発初心者",
    value: "クローンするだけで環境が整う",
    differentiator: "教育的協働で成長させる",
  };
}

function makeOutcomes(): Outcomes {
  return { items: [{ title: "Zero-setup", description: "即座に開発開始" }] };
}

Deno.test("establish-vision: establish が正しい Plan を生成する", () => {
  const identifier = identify(makeScope(), "Test Vision");
  const plan = visionUseCase.establish(identifier, makeStatement(), makeOutcomes());

  assertEquals(plan.summary, "Establish vision: Test Vision");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].operation, "searchItems");
  assertEquals(plan.steps[1].operation, "createItem");
  assertEquals(plan.steps[1].params.title, "Test Vision");
  assertEquals(plan.steps[2].operation, "addComment");
});

Deno.test("establish-vision: dry-run モードは Plan を実行せず表示する", () => {
  const identifier = identify(makeScope(), "Test Vision");
  const plan = visionUseCase.establish(identifier, makeStatement(), makeOutcomes());

  const dryRunOutput = { summary: plan.summary, steps: plan.steps };
  assertEquals(dryRunOutput.summary, "Establish vision: Test Vision");
  assertEquals(dryRunOutput.steps.length, 3);
  assertEquals(dryRunOutput.steps[0].operation, "searchItems");
  assertEquals(dryRunOutput.steps[1].operation, "createItem");
  assertEquals(dryRunOutput.steps[2].operation, "addComment");
});

Deno.test("establish-vision: 空のタイトルでエラー", () => {
  const identifier = identify(makeScope(), "");
  const statement = makeStatement();
  const outcomes = makeOutcomes();
  try {
    visionUseCase.establish(identifier, statement, outcomes);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message, "INVALID_INPUT: Vision title must not be empty");
  }
});
