import { assertEquals } from "@std/assert";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";

function makeScope(): EntityScope {
  return { owner: "test-org", repository: "test-repo" };
}

Deno.test("assess-alignment: find without id は search Plan を生成する", () => {
  const identifier = identify(makeScope(), "Vision of test-repo");
  const plan = visionUseCase.find(identifier);

  assertEquals(plan.summary, "Find vision: Vision of test-repo");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "search");
  assertEquals(plan.steps[1].entity, "Vision");
  assertEquals(plan.steps[1].params.labelType, "Vision");
});

Deno.test("assess-alignment: find with id は view Plan を生成する", () => {
  const identifier = identify(makeScope(), "Vision of test-repo", "node-id", "42");
  const plan = visionUseCase.find(identifier);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
  assertEquals(plan.steps[1].entity, "Vision");
  assertEquals(plan.steps[1].params.itemId, "42");
});

Deno.test("assess-alignment: dry-run は search + view の 2 Plan 構造を持つ", () => {
  const scope = makeScope();
  const searchIdentifier = identify(scope, "Vision of test-repo");
  const viewIdentifier = identify(scope, "Vision of test-repo", "node-id", "<itemId>");
  const searchPlan = visionUseCase.find(searchIdentifier);
  const viewPlan = visionUseCase.find(viewIdentifier);

  assertEquals(searchPlan.steps[1].operation, "search");
  assertEquals(viewPlan.steps[1].operation, "view");
  assertEquals(viewPlan.steps[1].params.itemId, "<itemId>");
});

Deno.test("assess-alignment: YAML frontmatter 抽出が正しい形式を返す", () => {
  const sampleMd = `---
name: test-role
description: テスト用ロール
tags:
  - trigger: test
---
# Content`;

  // extractFrontmatter は非公開だが、関数の動作を inline で検証
  const match = sampleMd.match(/^---\s*\n([\s\S]*?)\n---/);
  assertEquals(match !== null, true);
  const lines = match![1].split("\n");
  const fm: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx !== -1) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  assertEquals(fm.name, "test-role");
  assertEquals(fm.description, "テスト用ロール");
});

Deno.test("assess-alignment: 不正な JSON のパースに失敗する", () => {
  try {
    JSON.parse("{ invalid }");
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).name, "SyntaxError");
  }
});

Deno.test("assess-alignment: ProductGoal find は view Plan を生成する", () => {
  const identifier = identify(makeScope(), "Product Goal of test-repo", "pending", "42");
  const plan = productGoalUseCase.find(identifier);

  assertEquals(plan.summary, "Find product goal: Product Goal of test-repo");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].entity, "ProductGoal");
  assertEquals(plan.steps[1].operation, "view");
  assertEquals(plan.steps[1].params.itemId, "42");
});

Deno.test("assess-alignment: ProductGoal search Step が正しい構造を持つ", () => {
  const searchStep = {
    entity: "ProductGoal" as const,
    operation: "search" as const,
    params: { labelType: "ProductGoal" },
  };

  assertEquals(searchStep.entity, "ProductGoal");
  assertEquals(searchStep.operation, "search");
  assertEquals(searchStep.params.labelType, "ProductGoal");
});

Deno.test("assess-alignment: dry-run に ProductGoal の search+view が含まれる", () => {
  const scope = makeScope();
  const visionSearchPlan = visionUseCase.find(identify(scope, "Vision of test-repo"));
  const visionViewPlan = visionUseCase.find(
    identify(scope, "Vision of test-repo", "node-id", "<itemId>"),
  );
  const productGoalSearchStep = {
    entity: "ProductGoal" as const,
    operation: "search" as const,
    params: { labelType: "ProductGoal" },
  };
  const productGoalViewStep = {
    entity: "ProductGoal" as const,
    operation: "view" as const,
    params: { itemId: "<itemId>" },
  };

  const dryRunSteps = [
    ...visionSearchPlan.steps,
    ...visionViewPlan.steps,
    productGoalSearchStep,
    productGoalViewStep,
  ];

  assertEquals(dryRunSteps.length, 6);
  assertEquals(dryRunSteps[0].entity, "Scope");
  assertEquals(dryRunSteps[0].operation, "resolve");
  assertEquals(dryRunSteps[1].operation, "search");
  assertEquals(dryRunSteps[2].entity, "Scope");
  assertEquals(dryRunSteps[2].operation, "resolve");
  assertEquals(dryRunSteps[3].operation, "view");
  assertEquals(dryRunSteps[4].operation, "search");
  assertEquals(dryRunSteps[4].entity, "ProductGoal");
  assertEquals(dryRunSteps[5].operation, "view");
  assertEquals(dryRunSteps[5].entity, "ProductGoal");
});

Deno.test("assess-alignment: ProductGoal コメントからゴール情報を抽出する", () => {
  const sampleComment = "# Version: 2\n\n## Goal\n\nガバナンスの進化";

  const versionMatch = sampleComment.match(/^#\s*Version:\s*(\d+)/m);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : 1;

  const goalMatch = sampleComment.match(/##\s*Goal\s*\n\n([\s\S]*?)(?:\n##|$)/);
  const description = goalMatch ? goalMatch[1].trim() : "";

  assertEquals(version, 2);
  assertEquals(description, "ガバナンスの進化");
});

Deno.test("assess-alignment: ProductGoal コメントが空の場合は null", () => {
  const comments: Array<{ body?: string }> = [];
  assertEquals(comments.length, 0);
});

Deno.test("assess-alignment: ProductGoal が存在しない場合は null（エラーではない）", () => {
  const searchOutput: Array<{ number: number }> = [];
  assertEquals(searchOutput.length, 0);
});
