import { assertEquals, assertThrows } from "@std/assert";
import { pbiId } from "../../../../../core/domain/types.ts";
import type { WorkPackageData } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";

function makeWorkPackages(
  wps: Array<{ title: string; acItems: Array<{ number: string; description: string }> }>,
): WorkPackageData[] {
  return wps.map((wp) => ({
    identifier: {
      scope: { owner: "unknown", repository: "unknown" },
      title: { value: wp.title },
      describe: () => ({ summary: wp.title, steps: [] }),
    },
    statement: {
      acceptanceCriteria: {
        items: wp.acItems.map((ac) => ({
          number: ac.number,
          description: ac.description,
          judgment: "unchecked" as const,
        })),
      },
    },
    parentPbi: {
      scope: { owner: "unknown", repository: "unknown" },
      title: { value: "" },
      describe: () => ({ summary: "", steps: [] }),
    },
    stage: "idea",
    state: "open",
  }));
}

Deno.test("define_wp_acceptance_criteria - should generate plan for single WP", () => {
  const identifier = pbiId("Parent PBI", "node-id", "42");
  const wps = makeWorkPackages([
    { title: "WP1", acItems: [{ number: "1", description: "First AC" }] },
  ]);
  const plan = productBacklogItemUseCase.defineAcceptanceCriteria(identifier, wps);
  assertEquals(plan.summary, "Define acceptance criteria for: Parent PBI");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "defineAcceptanceCriteria");
});

Deno.test("define_wp_acceptance_criteria - should include AC body", () => {
  const identifier = pbiId("Parent PBI", "node-id", "42");
  const wps = makeWorkPackages([
    { title: "WP1", acItems: [{ number: "1", description: "First AC" }] },
  ]);
  const plan = productBacklogItemUseCase.defineAcceptanceCriteria(identifier, wps);
  assertEquals(plan.steps[1].params.body, "- [ ] AC1: First AC");
});

Deno.test("define_wp_acceptance_criteria - should handle multiple WPs", () => {
  const identifier = pbiId("Parent PBI", "node-id", "42");
  const wps = makeWorkPackages([
    { title: "WP1", acItems: [{ number: "1", description: "AC1" }] },
    { title: "WP2", acItems: [{ number: "1", description: "AC1" }] },
  ]);
  const plan = productBacklogItemUseCase.defineAcceptanceCriteria(identifier, wps);
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[1].params.title, "WP1");
  assertEquals(plan.steps[2].params.title, "WP2");
});

Deno.test("define_wp_acceptance_criteria - should throw for empty wps", () => {
  const identifier = pbiId("Parent PBI", "node-id", "42");
  assertThrows(
    () => productBacklogItemUseCase.defineAcceptanceCriteria(identifier, []),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("define_wp_acceptance_criteria - should throw for missing pbi id", () => {
  const identifier = pbiId("Parent PBI");
  const wps = makeWorkPackages([
    { title: "WP1", acItems: [{ number: "1", description: "AC1" }] },
  ]);
  assertThrows(
    () => productBacklogItemUseCase.defineAcceptanceCriteria(identifier, wps),
    Error,
    "INVALID_INPUT",
  );
});
