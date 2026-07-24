import { assertEquals } from "@std/assert";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import type { ProductBacklogItemSearchCondition } from "../../../../../core/domain/types.ts";

function makeCondition(
  keyword?: string,
  sprintNumber?: number,
  status?: string,
): ProductBacklogItemSearchCondition {
  const summaryParts: string[] = [];
  if (keyword) summaryParts.push(`keyword="${keyword}"`);
  if (sprintNumber !== undefined) summaryParts.push(`sprint=${sprintNumber}`);
  if (status) summaryParts.push(`status="${status}"`);
  return {
    keyword,
    sprintNumber,
    status,
    describe: () => ({
      summary: summaryParts.length > 0
        ? `Search PBI: ${summaryParts.join(", ")}`
        : "Search PBI: (all)",
      steps: [],
    }),
  };
}

Deno.test("search_pbi - search by keyword", () => {
  const condition = makeCondition("auth");
  const plan = productBacklogItemUseCase.search(condition);
  assertEquals(plan.summary, 'Search PBI: keyword="auth"');
});

Deno.test("search_pbi - search by sprintNumber", () => {
  const condition = makeCondition(undefined, 19);
  const plan = productBacklogItemUseCase.search(condition);
  assertEquals(plan.summary, "Search PBI: sprint=19");
});

Deno.test("search_pbi - search by status", () => {
  const condition = makeCondition(undefined, undefined, "todo");
  const plan = productBacklogItemUseCase.search(condition);
  assertEquals(plan.summary, 'Search PBI: status="todo"');
});

Deno.test("search_pbi - search with all filters", () => {
  const condition = makeCondition("auth", 19, "todo");
  const plan = productBacklogItemUseCase.search(condition);
  assertEquals(plan.summary, 'Search PBI: keyword="auth", sprint=19, status="todo"');
});

Deno.test("search_pbi - search without filters", () => {
  const condition = makeCondition();
  const plan = productBacklogItemUseCase.search(condition);
  assertEquals(plan.summary, "Search PBI: (all)");
});
