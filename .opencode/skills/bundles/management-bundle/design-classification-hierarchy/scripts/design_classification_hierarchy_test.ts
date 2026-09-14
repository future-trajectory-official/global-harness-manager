import { assertEquals, assertStringIncludes } from "@std/assert";
import { identify } from "../../../../../core/domain/types.ts";
import { epicUseCase } from "../../../../../core/domain/epic-usecase.ts";
import { featureUseCase } from "../../../../../core/domain/feature-usecase.ts";

const scope = { owner: "test", repository: "test-repo" };

Deno.test("define-epic should generate correct Plan", () => {
  const identifier = identify(scope, "認証基盤");
  const plan = epicUseCase.define(identifier, { description: "ユーザー認証に関する機能" });

  assertEquals(plan.summary, "Define epic: 認証基盤");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "Epic");
  assertEquals(plan.steps[1].operation, "create");
});

Deno.test("define-feature with parentEpic should generate correct Plan", () => {
  const featureId = identify(scope, "ログイン機能");
  const parentEpic = identify(scope, "認証基盤", "node-id-epic", "42");
  const plan = featureUseCase.define(
    featureId,
    { description: "ログイン画面と認証ロジック" },
    parentEpic,
  );

  assertEquals(plan.summary, "Define feature: ログイン機能");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "Feature");
  assertEquals(plan.steps[1].operation, "create");
  const params = plan.steps[1].params as Record<string, unknown>;
  assertEquals(params.parentEpic, "42");
});

Deno.test("define-epic should throw for empty title", () => {
  const identifier = identify(scope, "");
  try {
    epicUseCase.define(identifier, { description: "テスト" });
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "Epic title");
  }
});

Deno.test("define-feature should throw for empty description", () => {
  const identifier = identify(scope, "テスト");
  try {
    featureUseCase.define(identifier, { description: "" });
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as Error;
    assertStringIncludes(err.message, "FeatureStatement description");
  }
});

Deno.test("show-hierarchy should generate correct Plan", () => {
  const identifier = identify(scope, "認証基盤", "node-id-epic", "42");
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
    assertStringIncludes(err.message, "id");
  }
});
