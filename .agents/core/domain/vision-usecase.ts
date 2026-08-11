import type {
  ChangeReason,
  ExecutionResult,
  Outcomes,
  Plan,
  Step,
  StepResult,
  VisionIdentifier,
  VisionStatement,
} from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";

let _gateway: PlanGateway | undefined;

export function initVisionUseCase(gateway: PlanGateway): void {
  _gateway = gateway;
}

function scopeStep(identifier: VisionIdentifier): Step {
  return { entity: "Scope", operation: "resolve", params: { ...identifier.scope } };
}
import { assertIdDefined, assertStringNonEmpty, assertTitleNonEmpty } from "./validation.ts";

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Body: 変更履歴テーブル（初版）。pivot 時は formatVisionHistoryLine で行を追記する。 */
export function formatVisionBody(): string {
  const lines: string[] = [];
  lines.push("## History");
  lines.push("");
  lines.push("| 日付 | バージョン | 概要 |");
  lines.push("| ---- | ---------- | ---- |");
  lines.push(`| ${formatDate()} | 1 | プロジェクト開始 |`);
  return lines.join("\n");
}

/** Body: pivot時の変更履歴追記（既存履歴の末尾に追記される前提の行） */
export function formatVisionHistoryLine(version: number, reason: string): string {
  return `| ${formatDate()} | ${version} | ${reason} |\n`;
}

/** Comment: バージョン管理された本文（L2準拠） */
export function formatVisionComment(
  statement: VisionStatement,
  outcomes: Outcomes,
  version: number,
): string {
  const lines: string[] = [];
  lines.push(`# Version: ${version}`);
  lines.push("");
  if (statement.elevatorPitch) {
    lines.push("## Elevator Pitch");
    lines.push("");
    lines.push(statement.elevatorPitch);
    lines.push("");
  }
  if (statement.passion) {
    lines.push("## Passion");
    lines.push("");
    lines.push(statement.passion);
    lines.push("");
  }
  lines.push("## Statement");
  lines.push("");
  lines.push("### Target");
  lines.push("");
  lines.push(statement.targetAudience);
  lines.push("");
  lines.push("### Value");
  lines.push("");
  lines.push(statement.value);
  lines.push("");
  lines.push("### Differentiator");
  lines.push("");
  lines.push(statement.differentiator);
  lines.push("");
  lines.push("## Outcome");
  lines.push("");
  for (const item of outcomes.items) {
    lines.push(`### ${item.title}`);
    lines.push("");
    lines.push(item.description);
  }
  return lines.join("\n");
}

/**
 * Vision エンティティに対する全操作を定義するUseCaseインターフェース。
 *
 * 各メソッドはバリデーション後にPlan（実行計画）を返す。
 *
 * ## 識別子（identifier）の意味
 *
 * - `identifier.id` は GitHub node-id（グローバル識別子）、`identifier.code` はリポジトリ内識別子
 *   （Issue番号）を表す。
 * - 既存参照操作は `code`（Issue番号）で項目を特定する。Gateway層が `code` から node-id を
 *   内部解決して操作を行う。`id` を渡してもこの解決ステップは省かれず、
 *   パフォーマンスやAPI制限に問題が出るまで実装変更は行わない方針。
 */
export interface VisionUseCase {
  establish(identifier: VisionIdentifier, statement: VisionStatement, outcomes: Outcomes): Plan;
  pivot(
    identifier: VisionIdentifier,
    statement: VisionStatement,
    outcomes: Outcomes,
    reason: ChangeReason,
  ): Plan;
  find(identifier: VisionIdentifier): Plan;
}

export const visionUseCase: VisionUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  establish(identifier, statement, outcomes): Plan {
    assertTitleNonEmpty(identifier.title, "Vision title");
    assertStringNonEmpty(statement.targetAudience, "targetAudience");
    assertStringNonEmpty(statement.value, "value");
    assertStringNonEmpty(statement.differentiator, "differentiator");
    return {
      summary: `Establish vision: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "Vision",
          operation: "search",
          params: { labelType: "Vision" },
        },
        {
          entity: "Vision",
          operation: "create",
          params: {
            title: identifier.title.value,
            body: formatVisionBody(),
          },
        },
        {
          entity: "Vision",
          operation: "comment",
          params: {
            body: formatVisionComment(statement, outcomes, 1),
          },
        },
      ],
    };
  },

  pivot(identifier, statement, outcomes, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Vision title");
    assertStringNonEmpty(statement.targetAudience, "targetAudience");
    assertStringNonEmpty(statement.value, "value");
    assertStringNonEmpty(statement.differentiator, "differentiator");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    assertIdDefined(identifier.id, "pivot a vision");
    return {
      summary: `Pivot vision: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "Vision",
          operation: "update",
          params: {
            itemId: identifier.code,
            title: identifier.title.value,
            bodyAppend: formatVisionHistoryLine(2, reason.description),
          },
        },
        {
          entity: "Vision",
          operation: "comment",
          params: {
            body: formatVisionComment(statement, outcomes, 2),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Vision title");
    if (identifier.id || identifier.code) {
      return {
        summary: `Find vision: ${identifier.title.value}`,
        steps: [
          scopeStep(identifier),
          {
            entity: "Vision",
            operation: "view",
            params: { itemId: identifier.code ?? identifier.id },
          },
        ],
      };
    }
    return {
      summary: `Find vision: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        { entity: "Vision", operation: "search", params: { labelType: "Vision" } },
      ],
    };
  },

  async executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  > {
    if (!_gateway) throw new Error("VisionUseCase not initialized. Call initVisionUseCase first.");
    return await _executePlan(plan, _gateway);
  },
};
