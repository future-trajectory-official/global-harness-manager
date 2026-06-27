import type { Plan } from "./types.ts";
import type {
  ChangeReason,
  EffortRecord,
  ProcessAnalysis,
  ProductBacklogItemIdentifier,
  SessionMetrics,
  SprintIdentifier,
  WorkPackageIdentifier,
  WorkPackageSearchCondition,
  WorkPackageStatement,
} from "./types.ts";
import { assertIdDefined, assertStringNonEmpty, assertTitleNonEmpty } from "./validation.ts";

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

function formatEffortBody(effort: EffortRecord): string {
  const lines: string[] = [];
  lines.push("## Effort Record");
  lines.push("");
  lines.push(`- **Initial Estimate**: ${effort.initialEstimate}`);
  if (effort.plannedEstimate !== undefined) {
    lines.push(`- **Planned Estimate**: ${effort.plannedEstimate}`);
  }
  if (effort.actual !== undefined) {
    lines.push(`- **Actual**: ${effort.actual}`);
  }
  return lines.join("\n");
}

function formatAnalysisBody(analysis: ProcessAnalysis): string {
  const lines: string[] = [];
  lines.push("## Process Analysis");
  lines.push("");
  lines.push("### Planning Review");
  lines.push("");
  lines.push(analysis.planningReview);
  lines.push("");
  lines.push("### Execution Review");
  lines.push("");
  lines.push(analysis.executionReview);
  lines.push("");
  lines.push("### Improvement Suggestions");
  lines.push("");
  lines.push(analysis.improvementSuggestions);
  return lines.join("\n");
}

function formatSessionMetricsBody(metrics: SessionMetrics): string {
  const lines: string[] = [];
  lines.push("## Session Metrics");
  lines.push("");
  lines.push(`- **Intent Alignment Rate**: ${metrics.intentAlignmentRate}`);
  lines.push(`- **Constraint Adherence Score**: ${metrics.constraintAdherenceScore}`);
  lines.push(`- **Context Extraction Quality**: ${metrics.contextExtractionQuality}`);
  lines.push(`- **Work Size Stability**: ${metrics.workSizeStability}`);
  lines.push(`- **Comment**: ${metrics.comment}`);
  return lines.join("\n");
}

/**
 * WorkPackage（WP）エンティティに対する全操作を定義するUseCaseインターフェース。
 *
 * 各メソッドはバリデーション後にPlan（実行計画）を返す。
 * 状態遷移ルールや値の制約に関する詳細な検証は WpValidator で行う。
 */
export interface WorkPackageUseCase {
  /** WPを新規作成する。parentPbi必須、AC.items最低1件必須。 */
  define(
    identifier: WorkPackageIdentifier,
    statement: WorkPackageStatement,
    parentPbi: ProductBacklogItemIdentifier,
  ): Plan;

  /** WPをスプリントにコミットする。(idea,open)→(todo,open) への遷移をPlanに含める。 */
  commit(
    identifier: WorkPackageIdentifier,
    sprint: SprintIdentifier,
  ): Plan;

  /** WPの内容を更新する。完了済み(done)またはアーカイブ済み(closed)のWPは編集不可。 */
  revise(
    identifier: WorkPackageIdentifier,
    statement: WorkPackageStatement,
    reason: ChangeReason,
  ): Plan;

  /** WPの着手を開始する。(todo,open)→(inProgress,open) への遷移をPlanに含める。 */
  start(identifier: WorkPackageIdentifier): Plan;

  /**
   * WPを完了(done)状態に遷移させる。
   *
   * 親PBIの完了判定（全子WP完了→親PBI昇格）は本メソッドの責務とせず、
   * Skill層で行う。WP完了後、Skill層が親PBI配下の全WPをsearchし、
   * 全件doneの場合に親PBI UseCaseのcompleteを呼び出すこと。
   */
  complete(identifier: WorkPackageIdentifier): Plan;

  /** WPをアーカイブする。(done,open)→(done,closed) への遷移をPlanに含める。processEvidence必須。 */
  archive(identifier: WorkPackageIdentifier): Plan;

  /** WPを別のPBIに割り当てる（付け替え）。親PBIの死活チェックはGateway層で行う。 */
  assignToProductBacklogItem(
    identifier: WorkPackageIdentifier,
    pbi: ProductBacklogItemIdentifier,
  ): Plan;

  /** WPのPBI割り当てを解除する。 */
  unassignFromProductBacklogItem(
    identifier: WorkPackageIdentifier,
  ): Plan;

  /** WPの初期見積もり（initialEstimate）を記録する。ideaまたはtodoのWPのみ設定可能。 */
  estimateInitialEffort(
    identifier: WorkPackageIdentifier,
    effort: EffortRecord,
  ): Plan;

  /** WPの計画見積もり（plannedEstimate）を記録する。着手後(inProgress)のみ設定可能。planned >= initial 必須。 */
  estimatePlannedEffort(
    identifier: WorkPackageIdentifier,
    effort: EffortRecord,
  ): Plan;

  /** WPの実績工数（actual）を記録する。完了後(done,open)のみ設定可能。 */
  recordActualEffort(
    identifier: WorkPackageIdentifier,
    effort: EffortRecord,
  ): Plan;

  /** WPのプロセス分析（planningReview, executionReview, improvementSuggestions）を記録する。完了後(done,open)のみ。 */
  recordAnalysis(
    identifier: WorkPackageIdentifier,
    analysis: ProcessAnalysis,
  ): Plan;

  /** WPのセッションメトリクスを記録する。完了後(done,open)かつ全processEvidence完了が前提。 */
  recordSessionMetrics(
    identifier: WorkPackageIdentifier,
    metrics: SessionMetrics,
  ): Plan;

  /** WPをID検索する。 */
  find(identifier: WorkPackageIdentifier): Plan;

  /** WPを条件検索する。SearchCondition.describe()に委譲。 */
  search(condition: WorkPackageSearchCondition): Plan;
}

export const workPackageUseCase: WorkPackageUseCase = {
  define(identifier, statement, parentPbi): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    if (statement.acceptanceCriteria.items.length === 0) {
      throw new Error("INVALID_INPUT: At least one acceptance criterion is required");
    }
    assertIdDefined(parentPbi.id, "define a WP without parent PBI");
    return {
      summary: `Define WP: ${identifier.title.value}`,
      steps: [
        {
          operation: "createItem",
          params: {
            title: identifier.title.value,
            type: "WP",
            parentPbi: parentPbi.id,
            body: formatWpBody(statement),
          },
        },
        {
          operation: "addComment",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Define", `Defined ${identifier.title.value}`),
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
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            stage: "todo",
            state: "open",
            sprint: sprint.title.value,
          },
        },
        {
          operation: "editComment",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Commit", `Committed to ${sprint.title.value}`),
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
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            title: identifier.title.value,
            type: "WP",
            body: formatWpBody(statement),
          },
        },
        {
          operation: "editComment",
          params: {
            itemId: identifier.id,
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
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            stage: "inProgress",
            state: "open",
          },
        },
        {
          operation: "editComment",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Start", `Started work on ${identifier.title.value}`),
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
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            stage: "done",
            state: "open",
          },
        },
        {
          operation: "editComment",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Complete", `Completed ${identifier.title.value}`),
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
        {
          operation: "closeItem",
          params: {
            itemId: identifier.id,
            stage: "done",
            state: "closed",
          },
        },
        {
          operation: "editComment",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Archive", `Archived ${identifier.title.value}`),
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
      steps: [{
        operation: "updateItem",
        params: {
          itemId: identifier.id,
          parentPbi: pbi.id,
        },
      }],
    };
  },

  unassignFromProductBacklogItem(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "unassign a WP from a PBI");
    return {
      summary: `Unassign WP ${identifier.title.value} from PBI`,
      steps: [{
        operation: "updateItem",
        params: {
          itemId: identifier.id,
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
      steps: [{
        operation: "updateItem",
        params: {
          itemId: identifier.id,
          effortInitial: effort.initialEstimate,
          body: formatEffortBody(effort),
        },
      }],
    };
  },

  estimatePlannedEffort(identifier, effort): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "estimate planned effort for a WP");
    return {
      summary: `Estimate planned effort for WP: ${identifier.title.value}`,
      steps: [{
        operation: "updateItem",
        params: {
          itemId: identifier.id,
          effortPlanned: effort.plannedEstimate,
          body: formatEffortBody(effort),
        },
      }],
    };
  },

  recordActualEffort(identifier, effort): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "record actual effort for a WP");
    return {
      summary: `Record actual effort for WP: ${identifier.title.value}`,
      steps: [{
        operation: "updateItem",
        params: {
          itemId: identifier.id,
          effortActual: effort.actual,
          body: formatEffortBody(effort),
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
      steps: [{
        operation: "editComment",
        params: {
          itemId: identifier.id,
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
      steps: [{
        operation: "updateItem",
        params: {
          itemId: identifier.id,
          body: formatSessionMetricsBody(metrics),
        },
      }],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "WP title");
    assertIdDefined(identifier.id, "find a WP");
    return {
      summary: `Find WP: ${identifier.title.value}`,
      steps: [{
        operation: "findItem",
        params: {
          itemId: identifier.id,
          type: "WP",
        },
      }],
    };
  },

  search(condition): Plan {
    return {
      summary: condition.describe().summary,
      steps: condition.describe().steps,
    };
  },
};
