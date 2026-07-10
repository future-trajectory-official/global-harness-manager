import type { EntityScope, Plan, Step } from "./types.ts";
import type { ChangeReason, EpicIdentifier, EpicSearchCondition, EpicStatement } from "./types.ts";

function scopeStep(identifier: { scope: EntityScope }): Step {
  return {
    entity: "Scope" as const,
    operation: "resolve" as const,
    params: { ...identifier.scope },
  };
}
import { assertIdDefined, assertStringNonEmpty, assertTitleNonEmpty } from "./validation.ts";

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
}

export const epicUseCase: EpicUseCase = {
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
    assertIdDefined(identifier.id, "revise an epic");
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
    assertIdDefined(identifier.id, "find an epic");
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
};
