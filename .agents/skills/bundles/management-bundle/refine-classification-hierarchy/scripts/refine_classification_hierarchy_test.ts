import { assertEquals, assertStringIncludes } from "@std/assert";
import { identify } from "../../../../../core/domain/types.ts";
import { epicUseCase } from "../../../../../core/domain/epic-usecase.ts";
import { featureUseCase } from "../../../../../core/domain/feature-usecase.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";

const scope = { owner: "test", repository: "test-repo" };

// ===== show-hierarchy =====

Deno.test("show-hierarchy should generate correct Plan", () => {
  const identifier = identify(scope, "認証基盤", "42", "42");
  const plan = epicUseCase.showHierarchy(identifier);

  assertEquals(plan.summary, "Show hierarchy: 認証基盤");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "Epic");
  assertEquals(plan.steps[1].operation, "showHierarchy");
  const params = plan.steps[1].params as Record<string, unknown>;
  assertEquals(params.itemId, "42");
});

Deno.test("show-hierarchy should throw for undefined id", () => {
  const identifier = identify(scope, "認証基盤");
  try {
    epicUseCase.showHierarchy(identifier);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "show hierarchy");
  }
});

// ===== revise-epic =====

Deno.test("revise-epic should generate correct Plan", () => {
  const identifier = identify(scope, "認証基盤", "42", "42");
  const plan = epicUseCase.revise(
    identifier,
    { description: "ユーザー認証に関する全機能" },
    { description: "スコープ明確化" },
  );

  assertEquals(plan.summary, "Revise epic: 認証基盤");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[1].entity, "Epic");
  assertEquals(plan.steps[1].operation, "update");
  assertEquals(plan.steps[2].entity, "Epic");
  assertEquals(plan.steps[2].operation, "comment");
});

Deno.test("revise-epic should throw for empty description", () => {
  const identifier = identify(scope, "認証基盤", "42", "42");
  try {
    epicUseCase.revise(
      identifier,
      { description: "" },
      { description: "テスト" },
    );
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "EpicStatement description");
  }
});

// ===== revise-feature =====

Deno.test("revise-feature should generate correct Plan", () => {
  const identifier = identify(scope, "パスワード管理", "45", "45");
  const plan = featureUseCase.revise(
    identifier,
    { description: "パスワード変更・リセット" },
    { description: "スコープ明確化" },
  );

  assertEquals(plan.summary, "Revise feature: パスワード管理");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[1].entity, "Feature");
  assertEquals(plan.steps[1].operation, "update");
  assertEquals(plan.steps[2].entity, "Feature");
  assertEquals(plan.steps[2].operation, "comment");
});

Deno.test("revise-feature should succeed with code even if id is undefined", () => {
  const identifier = identify(scope, "パスワード管理", undefined, "99");
  const plan = featureUseCase.revise(
    identifier,
    { description: "テスト" },
    { description: "テスト" },
  );
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[1].params.itemId, "99");
});

// ===== assign-feature-to-epic =====

Deno.test("assign-feature-to-epic should generate correct Plan", () => {
  const featureId = identify(scope, "パスワード管理", "45", "45");
  const epic = identify(scope, "認証基盤", "42");
  const plan = featureUseCase.assignToEpic(featureId, epic);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "Feature");
  assertEquals(plan.steps[1].operation, "update");
  const params = plan.steps[1].params as Record<string, unknown>;
  assertEquals(params.parentEpic, "42");
});

Deno.test("assign-feature-to-epic should throw for undefined feature id", () => {
  const featureId = identify(scope, "パスワード管理");
  const epic = identify(scope, "認証基盤", "42");
  try {
    featureUseCase.assignToEpic(featureId, epic);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "assign a feature to an epic");
  }
});

Deno.test("assign-feature-to-epic should throw for undefined epic id", () => {
  const featureId = identify(scope, "パスワード管理", "45", "45");
  const epic = identify(scope, "認証基盤");
  try {
    featureUseCase.assignToEpic(featureId, epic);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "assign a feature to an epic without id");
  }
});

// ===== unassign-feature-from-epic =====

Deno.test("unassign-feature-from-epic should generate correct Plan", () => {
  const featureId = identify(scope, "パスワード管理", "45", "45");
  const plan = featureUseCase.unassignFromEpic(featureId);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "Feature");
  assertEquals(plan.steps[1].operation, "update");
  const params = plan.steps[1].params as Record<string, unknown>;
  assertEquals(params.parentEpic, undefined);
});

Deno.test("unassign-feature-from-epic should throw for undefined id", () => {
  const featureId = identify(scope, "パスワード管理");
  try {
    featureUseCase.unassignFromEpic(featureId);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "unassign a feature from an epic");
  }
});

// ===== assign-pbi-to-feature =====

Deno.test("assign-pbi-to-feature should generate correct Plan", () => {
  const pbiId = identify(scope, "パスワード変更画面", "50", "50");
  const feature = identify(scope, "パスワード管理", "45");
  const plan = productBacklogItemUseCase.assignToFeature(pbiId, feature);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "assignToFeature");
  const params = plan.steps[1].params as Record<string, unknown>;
  assertEquals(params.parentFeature, "45");
});

Deno.test("assign-pbi-to-feature should throw for undefined pbi id", () => {
  const pbiId = identify(scope, "パスワード変更画面");
  const feature = identify(scope, "パスワード管理", "45");
  try {
    productBacklogItemUseCase.assignToFeature(pbiId, feature);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "assign a PBI to a feature");
  }
});

Deno.test("assign-pbi-to-feature should throw for undefined feature id", () => {
  const pbiId = identify(scope, "パスワード変更画面", "50", "50");
  const feature = identify(scope, "パスワード管理");
  try {
    productBacklogItemUseCase.assignToFeature(pbiId, feature);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "assign a PBI to a feature without id");
  }
});

// ===== unassign-pbi-from-feature =====

Deno.test("unassign-pbi-from-feature should generate correct Plan", () => {
  const pbiId = identify(scope, "パスワード変更画面", "50", "50");
  const plan = productBacklogItemUseCase.unassignFromFeature(pbiId);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "unassignFromFeature");
  const params = plan.steps[1].params as Record<string, unknown>;
  assertEquals(params.parentFeature, undefined);
});

Deno.test("unassign-pbi-from-feature should throw for undefined id", () => {
  const pbiId = identify(scope, "パスワード変更画面");
  try {
    productBacklogItemUseCase.unassignFromFeature(pbiId);
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "unassign a PBI from a feature");
  }
});
