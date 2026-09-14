import { assertEquals, assertThrows } from "@std/assert";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { type EffortSummary, pbiId } from "../../../../../core/domain/types.ts";
import { buildPlan, hasAnalysis, validateInput } from "./record_pbi_effort_analysis.ts";

const IDENTIFIER = { title: "Sprint-End-Persistence", id: "node-id", code: "614" };

/**
 * @description analyzeEffort が正しい Plan（analyzeEffort操作）を生成すること
 * @verify steps が scope + analyzeEffort の2ステップであること
 */
Deno.test("record_pbi_effort_analysis - analyzeEffort plan without analysis", () => {
  const identifier = pbiId(IDENTIFIER.title, IDENTIFIER.id, IDENTIFIER.code);
  const plan = productBacklogItemUseCase.analyzeEffort(identifier);
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].entity, "ProductBacklogItem");
  assertEquals(plan.steps[1].operation, "analyzeEffort");
  assertEquals(plan.steps[1].params.itemId, IDENTIFIER.code);
});

/**
 * @description recordAnalysis が正しい Plan（recordAnalysis操作）を生成すること
 * @verify body に planning_variance_review / execution_variance_review が含まれること
 */
Deno.test("record_pbi_effort_analysis - recordAnalysis plan with analysis", () => {
  const identifier = pbiId(IDENTIFIER.title, IDENTIFIER.id, IDENTIFIER.code);
  const plan = productBacklogItemUseCase.recordAnalysis(identifier, {
    planningReview: "planning-review",
    executionReview: "execution-review",
    improvementSuggestions: "improvement",
  });
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].operation, "recordAnalysis");
  const body = plan.steps[1].params.body as string;
  assertEquals(JSON.parse(body).planning_variance_review, "planning-review");
  assertEquals(JSON.parse(body).execution_variance_review, "execution-review");
  assertEquals(JSON.parse(body).improvement_suggestions, "improvement");
});

/**
 * @description buildPlan が analyzeEffort + recordAnalysis の3ステップPlanを合成すること
 * @verify Scope → analyzeEffort → recordAnalysis の順になること
 */
Deno.test("record_pbi_effort_analysis - buildPlan combines analyzeEffort and recordAnalysis", () => {
  const plan = buildPlan({
    identifier: IDENTIFIER,
    planningReview: "planning-review",
    executionReview: "execution-review",
    improvementSuggestions: "improvement",
    effortSummary: { initialEstimate: 3, plannedEstimate: 4, actual: 5 },
  });
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "analyzeEffort");
  assertEquals(plan.steps[2].operation, "recordAnalysis");
});

/**
 * @description buildPlan が effortSummary を recordAnalysis の body に wp_effort_summary として含めること
 * @verify recordAnalysis step の body をパースした際に wp_effort_summary が期待値と一致すること
 */
Deno.test("record_pbi_effort_analysis - buildPlan includes wp_effort_summary in recordAnalysis body", () => {
  const plan = buildPlan({
    identifier: IDENTIFIER,
    planningReview: "planning-review",
    executionReview: "execution-review",
    improvementSuggestions: "improvement",
    effortSummary: { initialEstimate: 3, plannedEstimate: 4, actual: 5 },
  });
  const body = plan.steps[2].params.body as string;
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const summary = parsed.wp_effort_summary as Record<string, unknown>;
  assertEquals(summary.initial_estimate, 3);
  assertEquals(summary.planned_estimate, 4);
  assertEquals(summary.actual, 5);
});

/**
 * @description buildPlan が分析指定なしで analyzeEffort のみのPlanを返すこと
 * @verify steps が scope + analyzeEffort の2ステップであること
 */
Deno.test("record_pbi_effort_analysis - buildPlan returns analyzeEffort only when no analysis", () => {
  const plan = buildPlan({ identifier: IDENTIFIER });
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[1].operation, "analyzeEffort");
});

/**
 * @description hasAnalysis が improvementSuggestions のみ指定でも true を返すこと
 * @verify 4フィールド（review3項目 + effortSummary）いずれかの指定で分析ありと判定されること
 */
Deno.test("record_pbi_effort_analysis - hasAnalysis detects improvementSuggestions only", () => {
  assertEquals(hasAnalysis({ identifier: IDENTIFIER, improvementSuggestions: "improve" }), true);
  assertEquals(hasAnalysis({ identifier: IDENTIFIER }), false);
});

/**
 * @description hasAnalysis が effortSummary のみ指定でも true を返すこと
 * @verify effortSummary 単独指定が「分析あり」と判定され、サイレント破棄されないこと
 */
Deno.test("record_pbi_effort_analysis - hasAnalysis detects effortSummary only", () => {
  assertEquals(
    hasAnalysis({
      identifier: IDENTIFIER,
      effortSummary: { initialEstimate: 3, plannedEstimate: 4, actual: 5 },
    }),
    true,
  );
});

/**
 * @description validateInput が improvementSuggestions のみ指定時に明示エラーを出すこと
 * @verify planningReview 欠落で INVALID_INPUT エラーになること
 */
Deno.test("record_pbi_effort_analysis - validateInput rejects improvementSuggestions without planningReview", () => {
  assertThrows(
    () => validateInput({ identifier: IDENTIFIER, improvementSuggestions: "improve" }),
    Error,
    "planningReview",
  );
});

/**
 * @description validateInput が乖離分析記録時に effortSummary 欠落を INVALID_INPUT エラーで拒否すること
 * @verify effortSummary なしで recordAnalysis 入力が拒否されること
 */
Deno.test("record_pbi_effort_analysis - validateInput rejects analysis without effortSummary", () => {
  assertThrows(
    () =>
      validateInput({
        identifier: IDENTIFIER,
        planningReview: "planning-review",
        executionReview: "execution-review",
        improvementSuggestions: "improvement",
      }),
    Error,
    "effortSummary",
  );
});

/**
 * @description validateInput が正常入力を受け付けること
 * @verify 例外が発生しないこと
 */
Deno.test("record_pbi_effort_analysis - validateInput accepts valid analysis", () => {
  validateInput({
    identifier: IDENTIFIER,
    planningReview: "planning-review",
    executionReview: "execution-review",
    improvementSuggestions: "improvement",
    effortSummary: { initialEstimate: 3, plannedEstimate: 4, actual: 5 },
  });
});

/**
 * @description validateInput が空オブジェクトの effortSummary を INVALID_INPUT エラーで拒否すること
 * @verify フィールド未指定（undefined）で拒否されること
 */
Deno.test("record_pbi_effort_analysis - validateInput rejects empty effortSummary", () => {
  assertThrows(
    () =>
      validateInput({
        identifier: IDENTIFIER,
        planningReview: "planning-review",
        executionReview: "execution-review",
        improvementSuggestions: "improvement",
        effortSummary: {} as EffortSummary,
      }),
    Error,
    "effortSummary.initialEstimate",
  );
});

/**
 * @description validateInput が部分指定の effortSummary を INVALID_INPUT エラーで拒否すること
 * @verify 一部フィールドのみ指定（actual 欠落）で拒否されること
 */
Deno.test("record_pbi_effort_analysis - validateInput rejects partial effortSummary", () => {
  assertThrows(
    () =>
      validateInput({
        identifier: IDENTIFIER,
        planningReview: "planning-review",
        executionReview: "execution-review",
        improvementSuggestions: "improvement",
        effortSummary: { initialEstimate: 3, plannedEstimate: 4 } as EffortSummary,
      }),
    Error,
    "effortSummary.actual",
  );
});

/**
 * @description validateInput が負数の effortSummary を INVALID_INPUT エラーで拒否すること
 * @verify 負値で拒否されること
 */
Deno.test("record_pbi_effort_analysis - validateInput rejects negative effortSummary", () => {
  assertThrows(
    () =>
      validateInput({
        identifier: IDENTIFIER,
        planningReview: "planning-review",
        executionReview: "execution-review",
        improvementSuggestions: "improvement",
        effortSummary: { initialEstimate: -1, plannedEstimate: 4, actual: 5 },
      }),
    Error,
    "effortSummary.initialEstimate",
  );
});
