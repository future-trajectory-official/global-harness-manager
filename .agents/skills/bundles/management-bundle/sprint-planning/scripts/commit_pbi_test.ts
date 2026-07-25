import { assertEquals, assertThrows } from "@std/assert";
import { pbiId, sprintRef } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";

const validPbi = pbiId("Login feature", "42", "42");
const sprint19 = sprintRef(19);

Deno.test("commit_pbi - should generate commit plan", () => {
  const plan = productBacklogItemUseCase.commit(validPbi, sprint19);
  assertEquals(plan.summary, "Commit PBI Login feature to Sprint 19");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "commit");
});

Deno.test("commit_pbi - should throw for empty title", () => {
  assertThrows(
    () => productBacklogItemUseCase.commit(pbiId(""), sprint19),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("commit_pbi - should throw for undefined id", () => {
  assertThrows(
    () => productBacklogItemUseCase.commit(pbiId("Login feature", undefined, "42"), sprint19),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("commit_pbi - should throw for undefined sprint number", () => {
  assertThrows(
    () => productBacklogItemUseCase.commit(validPbi, sprintRef(undefined as unknown as number)),
    Error,
    "INVALID_INPUT",
  );
});
