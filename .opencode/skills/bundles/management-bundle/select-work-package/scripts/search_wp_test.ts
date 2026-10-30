import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { buildCondition, SEARCHABLE_STATUSES, validateInput } from "./search_wp.ts";

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

/**
 * @description 親PBI番号を指定した検索条件がPlanのparamsへ伝播すること（AC1-877）
 * @verify parentPbiNumber が steps[1].params.parentPbiNumber に設定され、statusの既定値はTodoであること
 */
Deno.test("search_wp - should propagate parentPbiNumber into plan params (AC1-877)", () => {
  const condition = buildCondition({ parentPbiNumber: 876 });
  const plan = workPackageUseCase.search(condition);

  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].operation, "search");
  assertEquals(plan.steps[1].params.parentPbiNumber, 876);
  assertEquals(plan.steps[1].params.status, "Todo");
  assertEquals(plan.steps[1].params.labelType, "WP");
});

/**
 * @description parentPbiNumber 未指定時に条件へ載らないこと（AC1-877）
 * @verify params.parentPbiNumber が undefined であること
 */
Deno.test("search_wp - should omit parentPbiNumber when not specified (AC1-877)", () => {
  const condition = buildCondition({ status: "In Progress", sprintNumber: 31 });
  const plan = workPackageUseCase.search(condition);

  assertEquals(plan.steps[1].params.parentPbiNumber, undefined);
  assertEquals(plan.steps[1].params.status, "In Progress");
  assertEquals(plan.steps[1].params.sprintNumber, 31);
});

/**
 * @description parentPbiNumber の不正値を入力検証で拒否すること（M2-877）
 * @verify INVALID_INPUT が投げられ、正の整数は通ること
 */
Deno.test("search_wp - should reject invalid parentPbiNumber (M2-877)", () => {
  assertThrows(() => validateInput({ parentPbiNumber: 0 }), Error, "INVALID_INPUT");
  assertThrows(() => validateInput({ parentPbiNumber: -3 }), Error, "INVALID_INPUT");
  assertThrows(() => validateInput({ parentPbiNumber: 1.5 }), Error, "INVALID_INPUT");
  validateInput({ parentPbiNumber: 876, status: "Todo", sprintNumber: 31 });
});

/**
 * @description 未知の status を入力検証で拒否すること（M2-877）
 * @verify 指定可能値以外は INVALID_INPUT、既知の値は通ること
 */
Deno.test("search_wp - should reject unknown status values (M2-877)", () => {
  assertThrows(() => validateInput({ status: "todo" }), Error, "INVALID_INPUT");
  assertThrows(() => validateInput({ status: "" }), Error, "INVALID_INPUT");
  for (const status of SEARCHABLE_STATUSES) validateInput({ status });
});

/**
 * @description Plan の summary に親PBI条件が現れること（M8-877）
 * @verify parentPbiNumber 指定時に summary へ parentPbi=876 が含まれること
 */
Deno.test("search_wp - should include parentPbi in the plan summary (M8-877)", () => {
  const plan = workPackageUseCase.search(buildCondition({ parentPbiNumber: 876 }));
  assertStringIncludes(plan.summary, "parentPbi=876");
});
