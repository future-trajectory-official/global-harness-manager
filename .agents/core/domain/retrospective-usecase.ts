import type { EntityScope, ExecutionResult, Plan, Step, StepResult } from "./types.ts";
import type {
  ChangeReason,
  KeepProblemTryAdvice,
  RetrospectiveIdentifier,
  RetrospectiveSearchCondition,
  SprintIdentifier,
  SprintMetrics,
} from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";

let _gateway: PlanGateway | undefined;

export function initRetrospectiveUseCase(gateway: PlanGateway): void {
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

/**
 * Retrospective（スプリント振り返り）エンティティに対する全操作を定義するUseCaseインターフェース。
 *
 * 各メソッドはバリデーション後にPlan（実行計画）を返す。
 * 状態遷移ルールや値の制約に関する詳細な検証は RetrospectiveValidator で行う。
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
export const retrospectiveUseCase: RetrospectiveUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  plan(identifier, sprint): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertTitleNonEmpty(sprint.title, "Sprint title");
    return {
      summary: `Plan retrospective: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
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
            itemId: identifier.code,
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
        scopeStep(identifier),
        {
          entity: "Retrospective",
          operation: "execute",
          params: {
            itemId: identifier.code,
            body: `${formatKptaBody(kpta)}\n\n${formatMetricsBody(metrics)}`,
            kpta,
            metrics,
          },
        },
        {
          entity: "Retrospective",
          operation: "execute",
          params: {
            itemId: identifier.code,
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
        scopeStep(identifier),
        {
          entity: "Retrospective",
          operation: "archive",
          params: {
            itemId: identifier.code,
            state: "closed",
          },
        },
        {
          entity: "Retrospective",
          operation: "archive",
          params: {
            itemId: identifier.code,
            body: formatEditComment("Archive", `Archived ${identifier.title.value}`),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertReferenceDefined(identifier.id, identifier.code, "find a retrospective");
    return {
      summary: `Find retrospective: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Retrospective",
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
      throw new Error("RetrospectiveUseCase not initialized. Call initRetrospectiveUseCase first.");
    }
    return await _executePlan(plan, _gateway);
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
