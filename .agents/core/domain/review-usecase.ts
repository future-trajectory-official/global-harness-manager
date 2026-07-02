import type { Plan } from "./types.ts";
import type {
  AcceptanceCriterias,
  ChangeReason,
  ReviewData,
  ReviewIdentifier,
  ReviewSearchCondition,
  SprintIdentifier,
} from "./types.ts";
import { assertIdDefined, assertStringNonEmpty, assertTitleNonEmpty } from "./validation.ts";

/** スプリントレビュー計画の入力。検証対象となるPBI/WP/ACの一覧と各ACの検証方法を定義する。 */
export interface ReviewPlanInput {
  readonly pbis: readonly ReviewPlanPbi[];
}

export interface ReviewPlanPbi {
  readonly number: number;
  readonly title: string;
  readonly wps: readonly ReviewPlanWp[];
}

export interface ReviewPlanWp {
  readonly number: number;
  readonly title: string;
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
  lines.push("## Sprint Review");
  lines.push("");
  lines.push(`- **Sprint**: ${sprint.title.value}`);
  lines.push("");
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
  lines.push("## 計画時確認項目");
  lines.push("");
  for (const pbi of planInput.pbis) {
    lines.push(`### 📦 PBI: [${pbi.number}] ${pbi.title}`);
    lines.push("");
    for (const wp of pbi.wps) {
      lines.push(`#### WP_${wp.number}: ${wp.title}`);
      lines.push("");
      for (const ac of wp.acs) {
        lines.push(`- ❔ AC_${ac.number}: ${ac.description}`);
        if (ac.verificationPlan) {
          lines.push(`  - **検証方法**: ${ac.verificationPlan}`);
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Review 改訂時の本文を生成する。削除ACは打ち消し線、追加ACはチェックボックス形式で表示する。 */
function formatReviewReviseBody(
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

/** Review（スプリントレビュー）エンティティに対する全操作を定義するUseCaseインターフェース。 */
export interface ReviewUseCase {
  /** Review Issue を新規作成する。対象スプリントを紐づけ、全ACを ❔ 未確認で列挙した検証台帳を生成する。 */
  plan(identifier: ReviewIdentifier, sprint: SprintIdentifier, planInput: ReviewPlanInput): Plan;

  /** Review の内容を改訂する。既存ACは論理削除（judgment=removed）のみ許可、新規ACは自由。 */
  revise(
    identifier: ReviewIdentifier,
    removed: AcceptanceCriterias | undefined,
    added: AcceptanceCriterias | undefined,
    reason: ChangeReason,
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
export const reviewUseCase: ReviewUseCase = {
  plan(identifier, sprint, planInput): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertTitleNonEmpty(sprint.title, "Sprint title");
    return {
      summary: `Plan review: ${identifier.title.value}`,
      steps: [
        {
          entity: "Review",
          operation: "plan",
          params: {
            title: identifier.title.value,
            body: formatPlanBody(sprint, planInput),
            sprint: sprint.title.value,
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.code,
            body: `Review planned for ${sprint.title.value}`,
          },
        },
      ],
    };
  },

  revise(identifier, removed, added, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertIdDefined(identifier.id, "revise a review");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return {
      summary: `Revise review: ${identifier.title.value}`,
      steps: [
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.code,
            title: identifier.title.value,
            body: formatReviewReviseBody(removed, added),
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.code,
            body: formatEditComment("Revise", reason.description),
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
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: data.identifier.code,
            body: formatEditComment("Report", `Overall: ${data.overallResult?.judgment ?? "N/A"}`),
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
        {
          entity: "Review",
          operation: "archive",
          params: {
            itemId: identifier.code,
            state: "closed",
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.code,
            body: formatEditComment("Archive", `Archived ${identifier.title.value}`),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Review title");
    assertIdDefined(identifier.id, "find a review");
    return {
      summary: `Find review: ${identifier.title.value}`,
      steps: [{
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
      steps: condition.describe().steps,
    };
  },
};

/** 操作コメントの本文を生成する。Markdown の H2 見出しで操作名と詳細を記述する。 */
function formatEditComment(operation: string, detail: string): string {
  const lines: string[] = [];
  lines.push(`## ${operation}`);
  lines.push("");
  lines.push(detail);
  return lines.join("\n");
}
