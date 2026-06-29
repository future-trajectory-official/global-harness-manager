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

/** Review Issue の初期本文を生成する。スプリント情報をヘッダーとして記述する。 */
function formatReviewBody(sprint: SprintIdentifier): string {
  const lines: string[] = [];
  lines.push("## Sprint Review");
  lines.push("");
  lines.push(`- **Sprint**: ${sprint.title.value}`);
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
  /** Review Issue を新規作成する。対象スプリントを紐づける。 */
  plan(identifier: ReviewIdentifier, sprint: SprintIdentifier): Plan;

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
  plan(identifier, sprint): Plan {
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
            body: formatReviewBody(sprint),
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.id,
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
            itemId: identifier.id,
            title: identifier.title.value,
            body: formatReviewReviseBody(removed, added),
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.id,
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
            itemId: data.identifier.id,
            body: formatReportBody(data),
            overallResult: data.overallResult,
            postPlanAcGroups: data.postPlanAcGroups,
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: data.identifier.id,
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
            itemId: identifier.id,
            state: "closed",
          },
        },
        {
          entity: "Review",
          operation: "update",
          params: {
            itemId: identifier.id,
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
          itemId: identifier.id,
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
