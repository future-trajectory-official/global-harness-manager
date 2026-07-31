import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import type { EffortRecord, Plan, ProcessAnalysis } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description recordActualEffortが正しいPlanを生成すること
 * @verify Planのstep数=2、scopeStep存在、operationが"recordActualEffort"、effortActualが入力値と一致
 */
Deno.test("record_effort - should generate plan", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 0, actual: 3 };
  const plan = workPackageUseCase.recordActualEffort(identifier, effort);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Record actual effort for WP: Test WP");
  assertEquals(plan.steps[1].operation, "recordActualEffort");
  assertEquals(plan.steps[1].params.effortActual, 3);
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("record_effort - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  const effort: EffortRecord = { initialEstimate: 0, actual: 3 };
  assertThrows(
    () => workPackageUseCase.recordActualEffort(identifier, effort),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 実績工数が0（境界値）でも正しくPlanが生成されること
 * @verify effortActual=0のStepが生成されること
 */
Deno.test("record_effort - should handle zero actual", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 0, actual: 0 };
  const plan = workPackageUseCase.recordActualEffort(identifier, effort);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].params.effortActual, 0);
});

/**
 * @description recordAnalysisが正しいPlanを生成すること
 * @verify Planのstep数=2、scopeStep存在、operationが"recordAnalysis"
 */
Deno.test("record_analysis - should generate plan", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const analysis: ProcessAnalysis = {
    planningReview: "Plan was clear",
    executionReview: "Execution went smoothly",
    improvementSuggestions: "More detail in ACs",
  };
  const plan = workPackageUseCase.recordAnalysis(identifier, analysis);
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Record analysis for WP: Test WP");
  assertEquals(plan.steps[1].operation, "update");
  assertEquals(plan.steps[2].operation, "recordAnalysis");
});

/**
 * @description planningReviewが空文字の場合にエラーが発生すること
 * @verify assertThrowsでエラーがスローされること
 */
Deno.test("record_analysis - should throw for empty planningReview", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const analysis: ProcessAnalysis = {
    planningReview: "",
    executionReview: "OK",
    improvementSuggestions: "",
  };
  assertThrows(
    () => workPackageUseCase.recordAnalysis(identifier, analysis),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 複合Plan（effort + analysis）が正しくマージされること
 * @verify 3つのStep（scope, recordActualEffort, recordAnalysis）で構成されること
 */
Deno.test("combined plan - should merge both operations", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const effort: EffortRecord = { initialEstimate: 0, actual: 3 };
  const analysis: ProcessAnalysis = {
    planningReview: "Plan was clear",
    executionReview: "Execution went smoothly",
    improvementSuggestions: "",
  };

  const effortPlan = workPackageUseCase.recordActualEffort(identifier, effort);
  const analysisPlan = workPackageUseCase.recordAnalysis(identifier, analysis);

  const combined: Plan = {
    summary: "Record effort + analysis for WP: Test WP",
    steps: [effortPlan.steps[0], effortPlan.steps[1], analysisPlan.steps[1], analysisPlan.steps[2]],
  };

  assertEquals(combined.steps.length, 4);
  assertEquals(combined.steps[0].entity, "Scope");
  assertEquals(combined.steps[1].entity, "WorkPackage");
  assertEquals(combined.steps[1].operation, "recordActualEffort");
  assertEquals(combined.steps[1].params.effortActual, 3);
  assertEquals(combined.steps[2].entity, "WorkPackage");
  assertEquals(combined.steps[2].operation, "update");
  assertEquals(combined.steps[3].entity, "WorkPackage");
  assertEquals(combined.steps[3].operation, "recordAnalysis");
});
