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
  assertSprintMetrics,
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

/** スプリントメトリクスの本文をMarkdown形式で生成する。5指標（達成度・正確性・品質・規律・ベロシティ）のスコアとナラティブを表示する。 */
function formatMetricsBody(metrics: SprintMetrics): string {
  const lines: string[] = [];
  lines.push("## Sprint Metrics");
  lines.push("");
  lines.push(`- **Goal Achievement Score**: ${metrics.summary.goalAchievementScore}`);
  lines.push(`- **Estimation Accuracy Score**: ${metrics.summary.estimationAccuracyScore}`);
  lines.push(`- **Quality Integrity Score**: ${metrics.summary.qualityIntegrityScore}`);
  lines.push(
    `- **Collaboration Discipline Score**: ${metrics.summary.collaborationDisciplineScore}`,
  );
  lines.push(`- **Velocity Value**: ${metrics.summary.velocity}`);
  lines.push(`- **Goal Achievement**: ${metrics.goalAchievement}`);
  lines.push(`- **Estimation Accuracy**: ${metrics.estimationAccuracy}`);
  lines.push(`- **Quality Integrity**: ${metrics.qualityIntegrity}`);
  lines.push(`- **Collaboration Discipline**: ${metrics.collaborationDiscipline}`);
  lines.push(`- **Velocity**: ${metrics.velocity}`);
  return lines.join("\n");
}

/**
 * Retrospective の記録操作（recordSprintKpt / recordSprintMetrics）の Plan を生成する。
 * 「記録Step（構造化params書込）＋変更理由コメントStep」の3Step構成を共通化する。
 */
function buildRecordPlan(options: {
  identifier: RetrospectiveIdentifier;
  operation: "recordSprintKpt" | "recordSprintMetrics";
  summary: string;
  body: string;
  writeParams: Record<string, unknown>;
  commentTitle: string;
  reason: ChangeReason;
}): Plan {
  return {
    summary: options.summary,
    steps: [
      scopeStep(options.identifier),
      {
        entity: "Retrospective",
        operation: options.operation,
        params: {
          itemId: options.identifier.code,
          body: options.body,
          ...options.writeParams,
        },
      },
      {
        entity: "Retrospective",
        operation: options.operation,
        params: {
          itemId: options.identifier.code,
          body: formatEditComment(options.commentTitle, options.reason.description),
        },
      },
    ],
  };
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

  /** スプリントKPT（Keep/Problem/Try/Advise）を記録する。KPTは harness-kpt-* の個別フィールドに保存される。 */
  recordSprintKpt(
    identifier: RetrospectiveIdentifier,
    kpta: KeepProblemTryAdvice,
    reason: ChangeReason,
  ): Plan;

  /** スプリントメトリクス（5指標）を記録する。summary と5指標ナラティブ独立フィールドに保存される。 */
  recordSprintMetrics(
    identifier: RetrospectiveIdentifier,
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
      ],
    };
  },

  recordSprintKpt(identifier, kpta, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertIdDefined(identifier.id, "record a sprint KPT");
    assertStringNonEmpty(kpta.keep, "KPTA keep");
    assertStringNonEmpty(kpta.problem, "KPTA problem");
    assertStringNonEmpty(kpta.try, "KPTA try");
    assertStringNonEmpty(kpta.advise, "KPTA advise");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return buildRecordPlan({
      identifier,
      operation: "recordSprintKpt",
      summary: `Record Sprint KPT: ${identifier.title.value}`,
      body: formatKptaBody(kpta),
      writeParams: { kpta },
      commentTitle: "Record Sprint KPT",
      reason,
    });
  },

  recordSprintMetrics(identifier, metrics, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Retrospective title");
    assertIdDefined(identifier.id, "record sprint metrics");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    assertSprintMetrics(metrics);
    return buildRecordPlan({
      identifier,
      operation: "recordSprintMetrics",
      summary: `Record Sprint Metrics: ${identifier.title.value}`,
      body: formatMetricsBody(metrics),
      writeParams: { metrics },
      commentTitle: "Record Sprint Metrics",
      reason,
    });
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
