import type { EntityScope, ExecutionResult, Plan, Step, StepResult } from "./types.ts";
import type {
  ChangeReason,
  EpicData,
  EpicIdentifier,
  EpicSearchCondition,
  EpicStatement,
} from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";

let _gateway: PlanGateway | undefined;

export function initEpicUseCase(gateway: PlanGateway): void {
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

/**
 * Epic の Issue Body を生成する。
 * Description セクションとステートメントを Markdown 形式で整形する。
 */
function formatEpicBody(statement: EpicStatement): string {
  const lines: string[] = [];
  lines.push("## Description");
  lines.push("");
  lines.push(statement.description);
  return lines.join("\n");
}

/**
 * Epic の改訂コメントを生成する。
 * 変更理由と更新後の説明文を Markdown 形式で整形する。
 */
function formatReviseComment(statement: EpicStatement, reason: ChangeReason): string {
  const lines: string[] = [];
  lines.push("## Revision");
  lines.push("");
  lines.push(`**Reason**: ${reason.description}`);
  lines.push("");
  lines.push(statement.description);
  return lines.join("\n");
}

/**
 * Epic の管理ユースケース。
 *
 * Epic の定義（作成）、再定義（更新）、特定（単一取得）、検索の操作を提供する。
 * 全ての変更操作は Gateway 層で実行可能な Plan を返す。
 *
 * ## 識別子（identifier）の意味
 *
 * - `identifier.id` は GitHub node-id（グローバル識別子）、`identifier.code` はリポジトリ内識別子
 *   （Issue番号）を表す。
 * - 既存参照操作は `code`（Issue番号）で項目を特定する。Gateway層が `code` から node-id を
 *   内部解決して操作を行う。`id` を渡してもこの解決ステップは省かれず、
 *   パフォーマンスやAPI制限に問題が出るまで実装変更は行わない方針。
 */
export interface EpicUseCase {
  /** 新規 Epic を定義する。identifier.id が undefined の場合、createItem を含む Plan を返す。 */
  define(identifier: EpicIdentifier, statement: EpicStatement): Plan;
  /**
   * 既存 Epic を再定義する。
   * updateItem で内容を更新し、addComment で変更理由を記録する Plan を返す。
   * identifier.id が undefined の場合はエラー。
   */
  revise(identifier: EpicIdentifier, statement: EpicStatement, reason: ChangeReason): Plan;
  /**
   * Epic を ID で特定する。
   * findItem を含む Plan を返す。identifier.id が undefined の場合はエラー。
   */
  find(identifier: EpicIdentifier): Plan;
  /**
   * Epic を検索条件で検索する。
   * searchItems を含む Plan を返す。実際の検索は Gateway 層が実行する。
   */
  search(condition: EpicSearchCondition): Plan;
  /**
   * Epic とその子フィーチャーの分類階層を表示する。
   * showHierarchy を含む Plan を返す。実際の取得は Gateway 層が GraphQL で実行する。
   * identifier.id が undefined の場合はエラー。
   */
  showHierarchy(identifier: EpicIdentifier): Plan;
  /**
   * 全Epicの分類階層を表示する。
   * 検索条件なしで全Epicを一覧し、各Epicの子フィーチャーを取得する Plan を返す。
   */
  showHierarchyAll(): Plan;
}

export const epicUseCase: EpicUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  define(identifier, statement): Plan {
    assertTitleNonEmpty(identifier.title, "Epic title");
    assertStringNonEmpty(statement.description, "EpicStatement description");
    return {
      summary: `Define epic: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Epic",
        operation: "create",
        params: {
          title: identifier.title.value,
          body: formatEpicBody(statement),
        },
      }],
    };
  },

  revise(identifier, statement, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Epic title");
    assertStringNonEmpty(statement.description, "EpicStatement description");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return {
      summary: `Revise epic: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "Epic",
          operation: "update",
          params: {
            itemId: identifier.code,
            title: identifier.title.value,
            body: formatEpicBody(statement),
          },
        },
        {
          entity: "Epic",
          operation: "comment",
          params: {
            body: formatReviseComment(statement, reason),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Epic title");
    assertReferenceDefined(identifier.id, identifier.code, "find an epic");
    return {
      summary: `Find epic: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Epic",
        operation: "view",
        params: { itemId: identifier.code },
      }],
    };
  },

  search(condition: EpicSearchCondition): Plan {
    return {
      summary: condition.describe().summary,
      steps: [{
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      }, ...condition.describe().steps],
    };
  },

  showHierarchy(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Epic title");
    assertIdDefined(identifier.id, "show hierarchy of an epic");
    return {
      summary: `Show hierarchy: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Epic",
        operation: "showHierarchy",
        params: { itemId: identifier.code },
      }],
    };
  },

  showHierarchyAll(): Plan {
    return {
      summary: "Show hierarchy of all epics",
      steps: [{
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      }, {
        entity: "Epic",
        operation: "showHierarchyAll",
        params: {},
      }],
    };
  },

  async executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  > {
    if (!_gateway) throw new Error("EpicUseCase not initialized. Call initEpicUseCase first.");
    return await _executePlan(plan, _gateway);
  },
};

/**
 * Epic の分類階層をツリー形式で整形する。
 * EpicData.features に子Featureが設定されていることを前提とする。
 */
export function formatEpicHierarchy(epic: EpicData): string {
  const lines: string[] = [];
  lines.push(`Epic #${epic.identifier.code ?? "?"}: ${epic.identifier.title.value}`);
  for (const feature of epic.features.items) {
    const featureId = feature.identifier.code ?? "?";
    lines.push(`  └── Feature #${featureId}: ${feature.identifier.title.value}`);
  }
  if (epic.features.items.length === 0) {
    lines.push("  （子Featureなし）");
  }
  return lines.join("\n");
}

/**
 * 全Epicの分類階層をツリー形式で整形する。
 */
export function formatAllEpicHierarchies(epics: EpicData[]): string {
  return epics.map((epic) => formatEpicHierarchy(epic)).join("\n\n");
}
