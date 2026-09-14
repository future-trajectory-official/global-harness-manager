import { assertEquals, assertThrows } from "@std/assert";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { assertByteLimit, BYTE_LIMIT } from "../../../../../core/shared/retrospective-utils.ts";
import { validateInput } from "./record_sprint_metrics.ts";

const VALID_INPUT = {
  sprintNumber: 20,
  code: "670",
  metrics: {
    summary: {
      goalAchievementScore: 5,
      estimationAccuracyScore: 4,
      qualityIntegrityScore: 4,
      collaborationDisciplineScore: 5,
      velocity: 21,
    },
    goalAchievement: "Goal achieved",
    estimationAccuracy: "Estimation was accurate",
    qualityIntegrity: "Quality maintained",
    collaborationDiscipline: "Discipline followed",
    velocity: "Velocity stable",
  },
  reason: { description: "Sprint 20 retrospective" },
};

/**
 * @description recordSprintMetrics が正しい Plan（recordSprintMetrics操作）を生成すること
 * @verify itemId に code、metrics が反映されること
 */
Deno.test("record_sprint_metrics - recordSprintMetrics builds correct plan", () => {
  const scope = { owner: "future-trajectory-official", repository: "global-harness-manager" };
  const identifier = identify(scope, "Sprint 20 Retrospective", "670", "670");
  const plan = retrospectiveUseCase.recordSprintMetrics(
    identifier,
    VALID_INPUT.metrics,
    VALID_INPUT.reason,
  ) as Plan;
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].operation, "recordSprintMetrics");
  const params = plan.steps[1].params as { itemId: string; metrics: typeof VALID_INPUT.metrics };
  assertEquals(params.itemId, "670");
  assertEquals(params.metrics.summary.velocity, 21);
});

/**
 * @description validateInput が正しい入力を拒否しないこと
 * @verify 例外が発生しないこと
 */
Deno.test("record_sprint_metrics - validateInput accepts valid input", () => {
  validateInput(VALID_INPUT);
});

/**
 * @description validateInput が範囲外スコア（0）を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects out-of-range score", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: {
          ...VALID_INPUT.metrics,
          summary: { ...VALID_INPUT.metrics.summary, goalAchievementScore: 0 },
        },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が範囲外スコア（6）を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects score above 5", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: {
          ...VALID_INPUT.metrics,
          summary: { ...VALID_INPUT.metrics.summary, qualityIntegrityScore: 6 },
        },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が負の velocity を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects negative velocity", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: {
          ...VALID_INPUT.metrics,
          summary: { ...VALID_INPUT.metrics.summary, velocity: -1 },
        },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が1024バイト超のナラティブを拒否すること
 * @verify INVALID_INPUT エラー（バイト制限）が発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects narrative over 1024 bytes", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: { ...VALID_INPUT.metrics, goalAchievement: "あ".repeat(400) },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が空のナラティブを拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects empty narrative", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: { ...VALID_INPUT.metrics, velocity: "" },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description assertByteLimit が1024バイト超を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - assertByteLimit rejects over 1024 bytes", () => {
  assertThrows(
    () => assertByteLimit("a".repeat(1025), "metrics.goalAchievement"),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description assertByteLimit がちょうど1024バイトを許可すること
 * @verify 例外が発生しないこと
 */
Deno.test("record_sprint_metrics - assertByteLimit allows exactly 1024 bytes", () => {
  assertByteLimit("a".repeat(BYTE_LIMIT), "metrics.goalAchievement");
});

/**
 * @description assertByteLimit がマルチバイト境界（1023B許可・1026B拒否）を正しく扱うこと
 * @verify 日本語341文字（1023B）は許可、342文字（1026B）は拒否
 */
Deno.test("record_sprint_metrics - assertByteLimit handles multibyte boundary", () => {
  assertByteLimit("あ".repeat(341), "metrics.goalAchievement");
  assertThrows(
    () => assertByteLimit("あ".repeat(342), "metrics.goalAchievement"),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が欠落した metrics.summary を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects missing summary", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: { ...VALID_INPUT.metrics, summary: undefined },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が小数スコア（3.5）を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects fractional score", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        metrics: {
          ...VALID_INPUT.metrics,
          summary: { ...VALID_INPUT.metrics.summary, goalAchievementScore: 3.5 },
        },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が空 code を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects empty code", () => {
  assertThrows(
    () => validateInput({ ...VALID_INPUT, code: "" }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が非正の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_metrics - validateInput rejects non-positive sprintNumber", () => {
  assertThrows(
    () => validateInput({ ...VALID_INPUT, sprintNumber: 0 }),
    Error,
    "INVALID_INPUT",
  );
});
