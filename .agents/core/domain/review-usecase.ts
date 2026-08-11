import type { EntityScope, ExecutionResult, Plan, Step, StepResult } from "./types.ts";

/** Review Issue 本文の Markdown マーカー定数。formatPlanBody と parseReviewBody で共有する。 */
export const REVIEW_MARKERS = {
  sprintGoalHeading: "## スプリントゴール",
  summaryPrefix: "- **概要**:",
  pbiMarker: "### 📦 PBI:",
  wpMarker: "#### WP_",
} as const;
import type {
  AcceptanceCriterias,
  AcGroup,
  ChangeReason,
  ReviewData,
  ReviewIdentifier,
  ReviewSearchCondition,
  SprintIdentifier,
} from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";
import {
  assertIdDefined,
  assertReferenceDefined,
  assertStringNonEmpty,
  assertTitleNonEmpty,
} from "./validation.ts";

let _gateway: PlanGateway | undefined;

export function initReviewUseCase(gateway: PlanGateway): void {
  _gateway = gateway;
}

function scopeStep(identifier: { scope: EntityScope }): Step {
  return {
    entity: "Scope" as const,
    operation: "resolve" as const,
    params: { ...identifier.scope },
  };
}

/** スプリントレビュー計画の入力。検証対象となるPBI/WP/ACの一覧と各ACの検証方法を定義する。 */
export interface ReviewPlanInput {
  readonly sprintGoal?: string;
  readonly pbis: readonly ReviewPlanPbi[];
}

export interface ReviewPlanPbi {
  readonly number: number;
  readonly title: string;
  readonly summary?: string;
  readonly wps: readonly ReviewPlanWp[];
}

export interface ReviewPlanWp {
  readonly number: number;
  readonly title: string;
  readonly summary?: string;
  readonly acs: readonly ReviewPlanAc[];
}

export interface ReviewPlanAc {
  readonly number: string;
  readonly description: string;
  readonly verificationPlan?: string;
}

/** Review Issue の計画本文を生成する。全ACを ❔ 未確認で列挙した検証台帳を作成する。 */
function formatPlanBody(sprint: SprintIdentifier, planInput: ReviewPlanInput): string {
  const lines: string[] = [];
  lines.push("## 凡例");
  lines.push("");
  lines.push(
    "- ❔ 未確認（初期状態。レビュー時に全ACを確認し、結果に応じて下記のいずれかに上書きする）",
  );
  lines.push("- ✅ 合格");
  lines.push("- ⚠️ 条件付き合格");
  lines.push("- ❌ 不合格");
  lines.push("- ➖ 論理削除（スプリント中の仕様変更等により確認対象外となったもの）");
  lines.push("");
  if (planInput.sprintGoal != null && planInput.sprintGoal.length > 0) {
    lines.push(REVIEW_MARKERS.sprintGoalHeading);
    lines.push("");
    lines.push(planInput.sprintGoal);
    lines.push("");
  }
  lines.push("## 概要");
  lines.push("");
  lines.push(`- **対象スプリント**: ${sprint.title.value}`);
  lines.push("- **実施環境**: ❔");
  lines.push("- **レビュー実施日**: ❔");
  lines.push("");
  lines.push("## 総合判定");
  lines.push("");
  lines.push("### 判定結果");
  lines.push("");
  lines.push("❔");
  lines.push("");
  lines.push("### PO意見");
  lines.push("");
  lines.push("❔");
  lines.push("");
  lines.push("## スプリント開始時検証計画");
  lines.push("");
  for (const pbi of planInput.pbis) {
    lines.push(`### 📦 PBI: [${pbi.number}] ${pbi.title}`);
    lines.push("");
    if (pbi.summary != null && pbi.summary.length > 0) {
      lines.push(`${REVIEW_MARKERS.summaryPrefix} ${pbi.summary}`);
      lines.push("");
    }
    for (const wp of pbi.wps) {
      lines.push(`#### WP_${wp.number}: ${wp.title}`);
      lines.push("");
      if (wp.summary != null && wp.summary.length > 0) {
        lines.push(`${REVIEW_MARKERS.summaryPrefix} ${wp.summary}`);
        lines.push("");
      }
      for (const ac of wp.acs) {
        lines.push(`- ❔ AC_${ac.number}: ${ac.description}`);
        if (ac.verificationPlan) {
          lines.push(`  - **検証方法**: ${ac.verificationPlan}`);
        }
      }
      lines.push("");
    }
  }
  lines.push("## スプリント中追加検証計画");
  lines.push("");
  lines.push("<!-- スプリント中に追加されたACがあれば記録 -->");
  lines.push("");
  return lines.join("\n");
}

/** Review 改訂時の本文を生成する。削除ACは打ち消し線、追加ACはチェックボックス形式で表示する。 */
function _formatReviewReviseBody(
  removed: AcceptanceCriterias | undefined,
  added: AcceptanceCriterias | undefined,
): string {
  const lines: string[] = [];
  if (removed && removed.items.length > 0) {
    lines.push("### Removed ACs");
    removed.items.forEach((ac) => {
      lines.push(`- ~~AC${ac.number}: ${ac.description}~~`);
    });
  }
  if (added && added.items.length > 0) {
    lines.push("### Added ACs");
    added.items.forEach((ac) => {
      lines.push(`- [ ] AC${ac.number}: ${ac.description}`);
    });
  }
  return lines.join("\n");
}

/** Review 報告時の本文を生成する。全体判定（pass/fail/conditional）とACごとの事後結果を表示する。 */
function formatReportBody(data: ReviewData): string {
  const lines: string[] = [];
  if (data.overallResult) {
    lines.push("## Overall Result");
    lines.push("");
    lines.push(`- **Judgment**: ${data.overallResult.judgment}`);
    lines.push(`- **Reason**: ${data.overallResult.reason}`);
  }
  if (data.postPlanAcGroups && data.postPlanAcGroups.length > 0) {
    lines.push("## Post-Plan AC Results");
    data.postPlanAcGroups.forEach((group) => {
      group.acJudgments.forEach((ac) => {
        const mark = ac.judgment === "pass" ? "🟢" : ac.judgment === "fail" ? "🔴" : "🟡";
        lines.push(`- ${mark} AC${ac.number}: ${ac.judgment}`);
      });
    });
  }
  return lines.join("\n");
}

/**
 * Review（スプリントレビュー）エンティティに対する全操作を定義するUseCaseインターフェース。
 *
 * 各メソッドはバリデーション後にPlan（実行計画）を返す。
 * 状態遷移ルールや値の制約に関する詳細な検証は ReviewValidator で行う。
 *
 * ## 識別子（identifier）の意味
 *
 * - `identifier.id` は GitHub node-id（グローバル識別子）、`identifier.code` はリポジトリ内識別子
 *   （Issue番号）を表す。
 * - 既存参照操作は `code`（Issue番号）で項目を特定する。Gateway層が `code` から node-id を
 *   内部解決して操作を行う。`id` を渡してもこの解決ステップは省かれず、
 *   パフォーマンスやAPI制限に問題が出るまで実装変更は行わない方針。
 * - 各操作の解決方法は操作ごとのJSDocに明記する。
 */
export interface ReviewUseCase {
  /** Review Issue を新規作成する。対象スプリントを紐づけ、全ACを ❔ 未確認で列挙した検証台帳を生成する。 */
  plan(identifier: ReviewIdentifier, sprint: SprintIdentifier, planInput: ReviewPlanInput): Plan;

  /** Review の内容を改訂する。既存ACは論理削除（judgment=removed）のみ許可、新規ACは自由。 */
  revise(
    identifier: ReviewIdentifier,
    removed: AcceptanceCriterias | undefined,
    added: AcceptanceCriterias | undefined,
    reason: ChangeReason,
    addedGroups?: readonly AcGroup[],
  ): Plan;

  /** Review の結果（全体判定・AC事後判定）を報告する。 */
  report(data: ReviewData): Plan;

  /** Review をアーカイブ（Close）する。overallResult の設定が必須。 */
  archive(identifier: ReviewIdentifier): Plan;

  /** Review を ID 検索する。 */
  find(identifier: ReviewIdentifier): Plan;

  /** Review を条件検索する。SearchCondition.describe() に委譲。 */
  search(condition: ReviewSearchCondition): Plan;
}

/** ReviewUseCase の具象実装。各メソッドは入力バリデーション後に Plan を生成する。 */
export const reviewUseCase: ReviewUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  plan(identifier, sprint, planInput): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertTitleNonEmpty(sprint.title, "Sprint title");
    return {
      summary: `Plan review: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "Review",
          operation: "plan",
          params: {
            title: identifier.title.value,
            body: formatPlanBody(sprint, planInput),
            sprint: sprint.title.value,
          },
        },
      ],
    };
  },

  revise(identifier, removed, added, reason, addedGroups?): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertIdDefined(identifier.id, "revise a review");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return {
      summary: `Revise review: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "Review",
          operation: "revise",
          params: {
            itemId: identifier.code,
            removed,
            added,
            addedGroups,
          },
        },
      ],
    };
  },

  report(data): Plan {
    assertTitleNonEmpty(data.identifier.title, "Review title");
    assertIdDefined(data.identifier.id, "report a review");
    return {
      summary: `Report review: ${data.identifier.title.value}`,
      steps: [
        scopeStep(data.identifier),
        {
          entity: "Review",
          operation: "report",
          params: {
            itemId: data.identifier.code,
            body: formatReportBody(data),
            overallResult: data.overallResult,
            postPlanAcGroups: data.postPlanAcGroups,
          },
        },
      ],
    };
  },

  archive(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertIdDefined(identifier.id, "archive a review");
    return {
      summary: `Archive review: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "Review",
          operation: "archive",
          params: {
            itemId: identifier.code,
            state: "closed",
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertReferenceDefined(identifier.id, identifier.code, "find a review");
    return {
      summary: `Find review: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Review",
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
    if (!_gateway) throw new Error("ReviewUseCase not initialized. Call initReviewUseCase first.");
    return await _executePlan(plan, _gateway);
  },
};
