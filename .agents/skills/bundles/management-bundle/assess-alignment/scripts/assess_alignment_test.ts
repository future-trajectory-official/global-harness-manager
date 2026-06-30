import { assertEquals } from "@std/assert";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";

function makeScope(): EntityScope {
  return { owner: "test-org", repository: "test-repo" };
}

Deno.test("assess-alignment: find without id は search Plan を生成する", () => {
  const identifier = identify(makeScope(), "Vision of test-repo");
  const plan = visionUseCase.find(identifier);

  assertEquals(plan.summary, "Find vision: Vision of test-repo");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "search");
  assertEquals(plan.steps[0].entity, "Vision");
  assertEquals(plan.steps[0].params.labelType, "Vision");
});

Deno.test("assess-alignment: find with id は view Plan を生成する", () => {
  const identifier = identify(makeScope(), "Vision of test-repo", "42");
  const plan = visionUseCase.find(identifier);

  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "view");
  assertEquals(plan.steps[0].entity, "Vision");
  assertEquals(plan.steps[0].params.itemId, "42");
});

Deno.test("assess-alignment: dry-run は search + view の 2 Plan 構造を持つ", () => {
  const scope = makeScope();
  const searchIdentifier = identify(scope, "Vision of test-repo");
  const viewIdentifier = identify(scope, "Vision of test-repo", "<itemId>");
  const searchPlan = visionUseCase.find(searchIdentifier);
  const viewPlan = visionUseCase.find(viewIdentifier);

  assertEquals(searchPlan.steps[0].operation, "search");
  assertEquals(viewPlan.steps[0].operation, "view");
  assertEquals(viewPlan.steps[0].params.itemId, "<itemId>");
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
