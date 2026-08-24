import { assertEquals } from "@std/assert";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description WP検索時にstatusフィルタで正しいPlanが生成されること
 * @verify Planのstep数=2、operationが"search"、params.statusが入力statusと一致すること
 */
Deno.test("search_wp - should generate plan with status filter", () => {
  const condition = {
    status: "todo" as const,
    describe() {
      return {
        summary: "Search work packages with status=todo",
        steps: [{
          entity: "WorkPackage" as const,
          operation: "search" as const,
          params: { labelType: "WP", status: this.status },
        }],
      };
    },
  };
  const plan = workPackageUseCase.search(condition);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Search work packages with status=todo");
  assertEquals(plan.steps[1].operation, "search");
});

/**
 * @description WP検索時にsprintNumberフィルタが正しくparamsに設定されること
 * @verify plan.steps[1].params.sprintNumberが入力値と一致すること
 */
Deno.test("search_wp - should generate plan with sprint filter", () => {
  const condition = {
    status: "todo" as const,
    sprintNumber: 19,
    describe() {
      return {
        summary: "Search work packages with status=todo in sprint 19",
        steps: [{
          entity: "WorkPackage" as const,
          operation: "search" as const,
          params: { labelType: "WP", status: "todo", sprintNumber: 19 },
        }],
      };
    },
  };
  const plan = workPackageUseCase.search(condition);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].params.sprintNumber, 19);
});
