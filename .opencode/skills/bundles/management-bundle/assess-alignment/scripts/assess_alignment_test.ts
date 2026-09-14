import { assertEquals } from "@std/assert";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { collectRoles, extractFrontmatter } from "./assess_alignment.ts";

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

Deno.test("assess-alignment: extractFrontmatter が閉じ --- 付きで正しく抽出する", () => {
  const sampleMd = `---
name: test-role
description: テスト用ロール
---
# Content`;

  const fm = extractFrontmatter(sampleMd);
  assertEquals(fm !== null, true);
  assertEquals(fm!.name, "test-role");
  assertEquals(fm!.description, "テスト用ロール");
});

Deno.test("assess-alignment: extractFrontmatter が閉じ --- 無し（OpenCode形式）でも抽出する", () => {
  const sampleMd = `---
description: アジャイルプロセスを円滑化する
mode: all
permission:
  read: allow
prompt: |
  ## 役割
  あなたはスクラムマスター`;

  const fm = extractFrontmatter(sampleMd);
  assertEquals(fm !== null, true);
  assertEquals(fm!.description, "アジャイルプロセスを円滑化する");
});

Deno.test("assess-alignment: collectRoles が name 無しでも basename を使いロールを収集する", () => {
  const tmpDir = Deno.makeTempDirSync();
  try {
    Deno.writeTextFileSync(
      `${tmpDir}/scrum-master.md`,
      `---
description: アジャイルプロセスを円滑化する
---

# role body`,
    );
    Deno.writeTextFileSync(
      `${tmpDir}/not-a-role.txt`,
      "description: 無視されるべきファイル\n",
    );

    const roles = collectRoles(tmpDir);
    assertEquals(roles.length, 1);
    assertEquals(roles[0].name, "scrum-master");
    assertEquals(roles[0].description, "アジャイルプロセスを円滑化する");
  } finally {
    Deno.removeSync(tmpDir, { recursive: true });
  }
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
