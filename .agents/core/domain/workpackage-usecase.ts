import type { EntityScope, ExecutionResult, Plan, Step, StepResult } from "./types.ts";
import type {
  ChangeReason,
  EffortRecord,
  KeepProblemTryAdvice,
  ProcessAnalysis,
  ProductBacklogItemIdentifier,
  SessionMetrics,
  SprintIdentifier,
  WorkPackageIdentifier,
  WorkPackageSearchCondition,
  WorkPackageStatement,
} from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";

let _gateway: PlanGateway | undefined;

export function initWorkPackageUseCase(gateway: PlanGateway): void {
  _gateway = gateway;
}

function scopeStep(identifier: { scope: EntityScope }): Step {
  return {
    entity: "Scope" as const,
    operation: "resolve" as const,
    params: { ...identifier.scope },
  };
}
import {
  assertIdDefined,
  assertReferenceDefined,
  assertStringNonEmpty,
  assertTitleNonEmpty,
} from "./validation.ts";

function formatWpBody(statement: WorkPackageStatement): string {
  const lines: string[] = [];
  lines.push("## Acceptance Criteria");
  lines.push("");
  statement.acceptanceCriteria.items.forEach((ac) => {
    lines.push(`- [ ] AC${ac.number}: ${ac.description}`);
  });
  return lines.join("\n");
}

function formatEditComment(operation: string, detail: string): string {
  const lines: string[] = [];
  lines.push(`## ${operation}`);
  lines.push("");
  lines.push(detail);
  return lines.join("\n");
}

function formatAnalysisBody(analysis: ProcessAnalysis): string {
  return JSON.stringify({
    planning_variance_review: analysis.planningReview,
    execution_variance_review: analysis.executionReview,
    improvement_suggestions: analysis.improvementSuggestions,
  });
}

function formatSessionMetricsBody(metrics: SessionMetrics): string {
  const lines: string[] = [];
  lines.push("## Session Metrics");
  lines.push("");
  lines.push(`- **Intent Alignment Score**: ${metrics.summary.intentAlignmentScore}`);
  lines.push(`- **Constraint Adherence Score**: ${metrics.summary.constraintAdherenceScore}`);
  lines.push(`- **Context Extraction Score**: ${metrics.summary.contextExtractionScore}`);
  lines.push(`- **Work Size Stability Score**: ${metrics.summary.workSizeStabilityScore}`);
  lines.push(`- **Intent Alignment**: ${metrics.intentAlignment}`);
  lines.push(`- **Constraint Adherence**: ${metrics.constraintAdherence}`);
  lines.push(`- **Context Extraction**: ${metrics.contextExtraction}`);
  lines.push(`- **Work Size Stability**: ${metrics.workSizeStability}`);
  return lines.join("\n");
}

/**
 * WorkPackage（WP）エンティティに対する全操作を定義するUseCaseインターフェース。
 *
 * 各メソッドはバリデーション後にPlan（実行計画）を返す。
 * 状態遷移ルールや値の制約に関する詳細な検証は WpValidator で行う。
 *
 * ## 識別子（identifier）の意味
 *
 * - `identifier.id` は GitHub node-id（グローバル識別子）、`identifier.code` はリポジトリ内識別子
 *   （Issue番号）を表す。
 * - 既存参照操作は `code`（Issue番号）で項目を特定する。Gateway層が `code` から node-id を
 *   内部解決し、ProjectV2 フィールド等の操作を行う。`id` を渡してもこの解決ステップは省かれず、
 *   パフォーマンスやAPI制限に問題が出るまで実装変更は行わない方針。
 * - 各操作の解決方法は操作ごとのJSDocに明記する。
 */
export interface WorkPackageUseCase {
  /** WPを新規作成する。parentPbi必須、AC.items最低1件必須。新規作成のため id/code は不要。 */
  define(
    identifier: WorkPackageIdentifier,
    statement: WorkPackageStatement,
    parentPbi: ProductBacklogItemIdentifier,
  ): Plan;

  /** WPをスプリントにコミットする。(idea,open)→(todo,open) への遷移をPlanに含める。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  commit(
    identifier: WorkPackageIdentifier,
    sprint: SprintIdentifier,
  ): Plan;

  /** WPの内容を更新する。完了済み(done)またはアーカイブ済み(closed)のWPは編集不可。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  revise(
    identifier: WorkPackageIdentifier,
    statement: WorkPackageStatement,
    reason: ChangeReason,
  ): Plan;

  /** WPの着手を開始する。(todo,open)→(inProgress,open) への遷移をPlanに含める。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  start(identifier: WorkPackageIdentifier): Plan;

  /**
   * WPを完了(done)状態に遷移させる。
   *
   * 親PBIの完了判定（全子WP完了→親PBI昇格）は本メソッドの責務とせず、
   * Skill層で行う。WP完了後、Skill層が親PBI配下の全WPをsearchし、
   * 全件doneの場合に親PBI UseCaseのcompleteを呼び出すこと。
   */
  /** WPを完了状態に遷移する。完了済み(done)への遷移をPlanに含める。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  complete(identifier: WorkPackageIdentifier): Plan;

  /** WPをアーカイブする。(done,open)→(done,closed) への遷移をPlanに含める。processEvidence必須。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  archive(identifier: WorkPackageIdentifier): Plan;

  /** WPを別のPBIに割り当てる（付け替え）。親PBIの死活チェックはGateway層で行う。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  assignToProductBacklogItem(
    identifier: WorkPackageIdentifier,
    pbi: ProductBacklogItemIdentifier,
  ): Plan;

  /** WPのPBI割り当てを解除する。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  unassignFromProductBacklogItem(
    identifier: WorkPackageIdentifier,
  ): Plan;

  /** WPの初期見積もり（initialEstimate）を記録する。ideaまたはtodoのWPのみ設定可能。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  estimateInitialEffort(
    identifier: WorkPackageIdentifier,
    effort: EffortRecord,
  ): Plan;

  /** WPの計画見積もり（plannedEstimate）を記録する。着手後(inProgress)のみ設定可能。planned >= initial 必須。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  estimatePlannedEffort(
    identifier: WorkPackageIdentifier,
    effort: EffortRecord,
  ): Plan;

  /** WPの実績工数（actual）を記録する。完了後(done,open)のみ設定可能。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  recordActualEffort(
    identifier: WorkPackageIdentifier,
    effort: EffortRecord,
  ): Plan;

  /** WPのプロセス分析（planningReview, executionReview, improvementSuggestions）を記録する。完了後(done,open)のみ。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  recordAnalysis(
    identifier: WorkPackageIdentifier,
    analysis: ProcessAnalysis,
  ): Plan;

  /** WPのセッションメトリクスを記録する。完了後(done,open)かつ全processEvidence完了が前提。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  recordSessionMetrics(
    identifier: WorkPackageIdentifier,
    metrics: SessionMetrics,
  ): Plan;

  /** WPのKPT（Keep/Problem/Try/Advise）を記録する。既存WPを対象とし、code（Issue番号）から node-id を内部解決して操作する。 */
  recordKpt(
    identifier: WorkPackageIdentifier,
    kpt: KeepProblemTryAdvice,
  ): Plan;

  /** WPをID検索する。code（Issue番号）から node-id を内部解決して操作する。 */
  find(identifier: WorkPackageIdentifier): Plan;

  /** WPを条件検索する。SearchCondition.describe()に委譲。 */
  search(condition: WorkPackageSearchCondition): Plan;
}

export const workPackageUseCase: WorkPackageUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  define(identifier, statement, parentPbi): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    if (statement.acceptanceCriteria.items.length === 0) {
      throw new Error("INVALID_INPUT: At least one acceptance criterion is required");
    }
    assertIdDefined(parentPbi.id, "define a WP without parent PBI");
    return {
      summary: `Define WP: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "WorkPackage",
          operation: "define",
          params: {
            title: identifier.title.value,
            parentPbi: parentPbi.code,
            body: formatWpBody(statement),
          },
        },
      ],
    };
  },

  commit(identifier, sprint): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "commit a WP");
    assertTitleNonEmpty(sprint.title, "Sprint title");
    return {
      summary: `Commit WP ${identifier.title.value} to ${sprint.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "WorkPackage",
          operation: "commit",
          params: {
            itemId: identifier.code,
            stage: "todo",
            state: "open",
            sprint: sprint.title.value,
          },
        },
      ],
    };
  },

  revise(identifier, statement, reason): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "revise a WP");
    if (statement.acceptanceCriteria.items.length === 0) {
      throw new Error(
        "INVALID_INPUT: Cannot revise WP with empty acceptance criteria. Use gh CLI directly for deletion.",
      );
    }
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return {
      summary: `Revise WP: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "WorkPackage",
          operation: "update",
          params: {
            itemId: identifier.code,
            title: identifier.title.value,
            body: formatWpBody(statement),
          },
        },
        {
          entity: "WorkPackage",
          operation: "comment",
          params: {
            itemId: identifier.code,
            body: formatEditComment("Revise", reason.description),
          },
        },
      ],
    };
  },

  start(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "start a WP");
    return {
      summary: `Start WP: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "WorkPackage",
          operation: "start",
          params: {
            itemId: identifier.code,
            stage: "inProgress",
            state: "open",
          },
        },
      ],
    };
  },

  complete(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "complete a WP");
    return {
      summary: `Complete WP: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "WorkPackage",
          operation: "complete",
          params: {
            itemId: identifier.code,
            stage: "done",
            state: "open",
          },
        },
      ],
    };
  },

  archive(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "archive a WP");
    return {
      summary: `Archive WP: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "WorkPackage",
          operation: "archive",
          params: {
            itemId: identifier.code,
            stage: "done",
            state: "closed",
          },
        },
      ],
    };
  },

  assignToProductBacklogItem(identifier, pbi): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "assign a WP to a PBI");
    assertIdDefined(pbi.id, "assign a WP to a PBI without id");
    return {
      summary: `Assign WP ${identifier.title.value} to PBI ${pbi.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "assignToProductBacklogItem",
        params: {
          itemId: identifier.code,
          parentPbi: pbi.code,
        },
      }],
    };
  },

  unassignFromProductBacklogItem(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "unassign a WP from a PBI");
    return {
      summary: `Unassign WP ${identifier.title.value} from PBI`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "unassignFromProductBacklogItem",
        params: {
          itemId: identifier.code,
          parentPbi: undefined,
        },
      }],
    };
  },

  estimateInitialEffort(identifier, effort): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "estimate initial effort for a WP");
    return {
      summary: `Estimate initial effort for WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "estimateInitialEffort",
        params: {
          itemId: identifier.code,
          effortInitial: effort.initialEstimate,
        },
      }],
    };
  },

  estimatePlannedEffort(identifier, effort): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "estimate planned effort for a WP");
    return {
      summary: `Estimate planned effort for WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "estimatePlannedEffort",
        params: {
          itemId: identifier.code,
          effortPlanned: effort.plannedEstimate,
        },
      }],
    };
  },

  recordActualEffort(identifier, effort): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "record actual effort for a WP");
    return {
      summary: `Record actual effort for WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "recordActualEffort",
        params: {
          itemId: identifier.code,
          effortActual: effort.actual,
        },
      }],
    };
  },

  recordAnalysis(identifier, analysis): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "record analysis for a WP");
    assertStringNonEmpty(analysis.planningReview, "planningReview");
    return {
      summary: `Record analysis for WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "recordAnalysis",
        params: {
          itemId: identifier.code,
          body: formatAnalysisBody(analysis),
        },
      }],
    };
  },

  recordSessionMetrics(identifier, metrics): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "record session metrics for a WP");
    return {
      summary: `Record session metrics for WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "recordSessionMetrics",
        params: {
          itemId: identifier.code,
          body: formatSessionMetricsBody(metrics),
          metrics: metrics,
        },
      }],
    };
  },

  recordKpt(identifier, kpt): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "record KPT for a WP");
    return {
      summary: `Record KPT for WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "recordKpt",
        params: {
          itemId: identifier.code,
          kpt,
        },
      }],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertReferenceDefined(identifier.id, identifier.code, "find a WP");
    return {
      summary: `Find WP: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "WorkPackage",
        operation: "view",
        params: {
          itemId: identifier.code,
        },
      }],
    };
  },

  search(condition): Plan {
    return {
      summary: condition.describe().summary,
      steps: [{
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      }, ...condition.describe().steps],
    };
  },

  async executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  > {
    if (!_gateway) {
      throw new Error("WorkPackageUseCase not initialized. Call initWorkPackageUseCase first.");
    }
    return await _executePlan(plan, _gateway);
  },
};
