import { assertEquals, assertThrows } from "@std/assert";
import { wpId } from "../../../../../core/domain/types.ts";
import type { SessionMetrics } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

/**
 * @description セッションメトリクス記録時に全フィールドを含むPlanが生成されること
 * @verify Planのstep数=2、scopeStep存在、operationが"recordSessionMetrics"
 */
Deno.test("record_metrics - should generate plan with all fields", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 4,
    contextExtractionQuality: 3,
    workSizeStability: 5,
    comment: "Good session",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.summary, "Record session metrics for WP: Test WP");
  assertEquals(plan.steps[1].operation, "recordSessionMetrics");
  assertEquals(plan.steps[1].entity, "WorkPackage");
});

/**
 * @description identifier.idが未定義の場合にエラーが発生すること
 * @verify assertThrowsでINVALID_INPUTエラーがスローされること
 */
Deno.test("record_metrics - should throw for missing identifier id", () => {
  const identifier = wpId("Test WP");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 5,
    contextExtractionQuality: 5,
    workSizeStability: 5,
    comment: "",
  };
  assertThrows(
    () => workPackageUseCase.recordSessionMetrics(identifier, metrics),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description 全スコアがMarkdown形式でbodyに正しくフォーマットされること
 * @verify body文字列に全スコア値とコメントが含まれていること
 */
Deno.test("record_metrics - should include body with all scores", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 3,
    constraintAdherenceScore: 4,
    contextExtractionQuality: 2,
    workSizeStability: 5,
    comment: "Needs improvement on context extraction",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  const body = plan.steps[1].params.body;
  assertEquals(typeof body, "string");
  const bodyStr = body as string;
  assertEquals(bodyStr.includes("**Intent Alignment Rate**: 3"), true);
  assertEquals(bodyStr.includes("**Constraint Adherence Score**: 4"), true);
  assertEquals(bodyStr.includes("**Context Extraction Quality**: 2"), true);
  assertEquals(bodyStr.includes("**Work Size Stability**: 5"), true);
  assertEquals(bodyStr.includes("Needs improvement"), true);
});

/**
 * @description commentが空文字でも正しくPlanが生成されること
 * @verify operationが"recordSessionMetrics"であること
 */
Deno.test("record_metrics - should handle empty comment", () => {
  const identifier = wpId("Test WP", "node-id", "42");
  const metrics: SessionMetrics = {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 5,
    contextExtractionQuality: 5,
    workSizeStability: 5,
    comment: "",
  };
  const plan = workPackageUseCase.recordSessionMetrics(identifier, metrics);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].operation, "recordSessionMetrics");
});
