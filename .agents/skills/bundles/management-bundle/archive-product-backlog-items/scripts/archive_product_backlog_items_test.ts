import { assertEquals } from "@std/assert";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { pbiId, wpId } from "../../../../../core/domain/types.ts";

/**
 * @description workPackageUseCase.archive が正しい Plan（archive操作）を生成すること
 * @verify itemId に code、stage/state が closed になること
 */
Deno.test("archive_wp - workPackageUseCase.archive plan", () => {
  const identifier = wpId("Skill scripts", "node-id", "42");
  const plan = workPackageUseCase.archive(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].entity, "WorkPackage");
  assertEquals(plan.steps[1].operation, "archive");
  assertEquals(plan.steps[1].params.itemId, "42");
  assertEquals(plan.steps[1].params.stage, "done");
  assertEquals(plan.steps[1].params.state, "closed");
});

/**
 * @description productBacklogItemUseCase.archive が正しい Plan（archive操作）を生成すること
 * @verify itemId に code、stage/state が closed になること
 */
Deno.test("archive_pbi - productBacklogItemUseCase.archive plan", () => {
  const identifier = pbiId("Sprint-End-Persistence", "node-id", "614");
  const plan = productBacklogItemUseCase.archive(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "archive");
  assertEquals(plan.steps[1].params.itemId, "614");
  assertEquals(plan.steps[1].params.stage, "done");
  assertEquals(plan.steps[1].params.state, "closed");
});
