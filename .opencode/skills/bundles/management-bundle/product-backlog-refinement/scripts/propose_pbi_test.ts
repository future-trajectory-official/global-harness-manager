import { assertEquals, assertThrows } from "@std/assert";
import { featureId, pbiId } from "../../../../../core/domain/types.ts";
import type { ProductBacklogItemStatement } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";

Deno.test("propose_pbi - should generate propose plan", () => {
  const identifier = pbiId("My PBI");
  const statement: ProductBacklogItemStatement = { summary: "Implement feature X" };
  const plan = productBacklogItemUseCase.propose(identifier, statement);
  assertEquals(plan.summary, "Propose PBI: My PBI");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "propose");
});

Deno.test("propose_pbi - should include parentFeature when provided", () => {
  const identifier = pbiId("My PBI");
  const statement: ProductBacklogItemStatement = { summary: "Implement feature X" };
  const parentFeature = featureId("Auth", "node-id-123", "42");
  const plan = productBacklogItemUseCase.propose(identifier, statement, parentFeature);
  assertEquals(plan.steps[1].params.parentFeature, "42");
});

Deno.test("propose_pbi - should throw for empty title", () => {
  const identifier = pbiId("");
  const statement: ProductBacklogItemStatement = { summary: "test" };
  assertThrows(
    () => productBacklogItemUseCase.propose(identifier, statement),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("propose_pbi - should throw for empty summary", () => {
  const identifier = pbiId("My PBI");
  const statement: ProductBacklogItemStatement = { summary: "" };
  assertThrows(
    () => productBacklogItemUseCase.propose(identifier, statement),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("propose_pbi - should throw when parentFeature has no id", () => {
  const identifier = pbiId("My PBI");
  const statement: ProductBacklogItemStatement = { summary: "test" };
  assertThrows(
    () => productBacklogItemUseCase.propose(identifier, statement, featureId("Auth")),
    Error,
    "INVALID_INPUT",
  );
});
