import type { Plan } from "./types.ts";
import type {
  ChangeReason,
  KeepProblemTryAdvice,
  RetrospectiveIdentifier,
  RetrospectiveSearchCondition,
  SprintIdentifier,
  SprintMetrics,
} from "./types.ts";
import { assertIdDefined, assertStringNonEmpty, assertTitleNonEmpty } from "./validation.ts";

/** Retrospective Issue の初期本文を生成する。スプリント情報をヘッダーとして記述する。 */
function formatRetroBody(sprint: SprintIdentifier): string {
  const lines: string[] = [];
  lines.push("## Sprint Retrospective");
  lines.push("");
  lines.push(`- **Sprint**: ${sprint.title.value}`);
  return lines.join("\n");
}

/** KPTA（Keep/Problem/Try/Advise）の本文をMarkdown形式で生成する。 */
function formatKptaBody(kpta: KeepProblemTryAdvice): string {
  const lines: string[] = [];
  lines.push("## KPTA");
  lines.push("");
  lines.push("### Keep");
  lines.push(kpta.keep);
  lines.push("");
  lines.push("### Problem");
  lines.push(kpta.problem);
  lines.push("");
  lines.push("### Try");
  lines.push(kpta.try);
  lines.push("");
  lines.push("### Advise");
  lines.push(kpta.advise);
  return lines.join("\n");
}

/** スプリントメトリクスの本文をMarkdown形式で生成する。5指標（達成率・正確性・品質・規律・ベロシティ）を表示する。 */
function formatMetricsBody(metrics: SprintMetrics): string {
  const lines: string[] = [];
  lines.push("## Sprint Metrics");
  lines.push("");
  lines.push(`- **Goal Achievement Rate**: ${metrics.goalAchievementRate}%`);
  lines.push(`- **Estimation Accuracy**: ${metrics.estimationAccuracy}%`);
  lines.push(`- **Quality Integrity**: ${metrics.qualityIntegrity}%`);
  lines.push(`- **Collaboration Discipline**: ${metrics.collaborationDiscipline}%`);
  lines.push(`- **Velocity**: ${metrics.velocity}`);
  return lines.join("\n");
}

/** Retrospective（スプリント振り返り）エンティティに対する全操作を定義するUseCaseインターフェース。 */
export interface RetrospectiveUseCase {
  /** Retrospective Issue を新規作成する。対象スプリントを紐づける。 */
  plan(identifier: RetrospectiveIdentifier, sprint: SprintIdentifier): Plan;

  /** Retrospective を実行し、KPTA とスプリントメトリクスを記録する。 */
  execute(
    identifier: RetrospectiveIdentifier,
    kpta: KeepProblemTryAdvice,
    metrics: SprintMetrics,
    reason: ChangeReason,
  ): Plan;

  /** Retrospective をアーカイブ（Close）する。KPTA と metrics の設定が必須。 */
  archive(identifier: RetrospectiveIdentifier): Plan;

  /** Retrospective を ID 検索する。 */
  find(identifier: RetrospectiveIdentifier): Plan;

  /** Retrospective を条件検索する。SearchCondition.describe() に委譲。 */
  search(condition: RetrospectiveSearchCondition): Plan;
}

/** RetrospectiveUseCase の具象実装。各メソッドは入力バリデーション後に Plan を生成する。 */
export const retrospectiveUseCase: RetrospectiveUseCase = {
  plan(identifier, sprint): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertTitleNonEmpty(sprint.title, "Sprint title");
    return {
      summary: `Plan retrospective: ${identifier.title.value}`,
      steps: [
        {
          entity: "Retrospective",
          operation: "plan",
          params: {
            title: identifier.title.value,
            body: formatRetroBody(sprint),
          },
        },
        {
          entity: "Retrospective",
          operation: "execute",
          params: {
            itemId: identifier.id,
            body: `Retrospective planned for ${sprint.title.value}`,
          },
        },
      ],
    };
  },

  execute(identifier, kpta, metrics, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertIdDefined(identifier.id, "execute a retrospective");
    assertStringNonEmpty(kpta.keep, "KPTA keep");
    assertStringNonEmpty(kpta.problem, "KPTA problem");
    assertStringNonEmpty(kpta.try, "KPTA try");
    assertStringNonEmpty(kpta.advise, "KPTA advise");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return {
      summary: `Execute retrospective: ${identifier.title.value}`,
      steps: [
        {
          entity: "Retrospective",
          operation: "execute",
          params: {
            itemId: identifier.id,
            body: `${formatKptaBody(kpta)}\n\n${formatMetricsBody(metrics)}`,
            kpta,
            metrics,
          },
        },
        {
          entity: "Retrospective",
          operation: "execute",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Execute", reason.description),
          },
        },
      ],
    };
  },

  archive(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertIdDefined(identifier.id, "archive a retrospective");
    return {
      summary: `Archive retrospective: ${identifier.title.value}`,
      steps: [
        {
          entity: "Retrospective",
          operation: "archive",
          params: {
            itemId: identifier.id,
            state: "closed",
          },
        },
        {
          entity: "Retrospective",
          operation: "archive",
          params: {
            itemId: identifier.id,
            body: formatEditComment("Archive", `Archived ${identifier.title.value}`),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertIdDefined(identifier.id, "find a retrospective");
    return {
      summary: `Find retrospective: ${identifier.title.value}`,
      steps: [{
        entity: "Retrospective",
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
