import type { Plan } from "./types.ts";
import type {
  ChangeReason,
  EpicIdentifier,
  FeatureIdentifier,
  FeatureSearchCondition,
  FeatureStatement,
} from "./types.ts";
import { assertIdDefined, assertStringNonEmpty, assertTitleNonEmpty } from "./validation.ts";

/**
 * Feature の Issue Body を生成する。
 * Description セクションと親 Epic 参照を Markdown 形式で整形する。
 */
function formatFeatureBody(statement: FeatureStatement, parentEpicId?: string): string {
  const lines: string[] = [];
  lines.push("## Description");
  lines.push("");
  lines.push(statement.description);
  lines.push("");
  if (parentEpicId) {
    lines.push(`**Parent Epic**: ${parentEpicId}`);
  }
  return lines.join("\n");
}

/**
 * Feature の改訂コメントを生成する。
 * 変更理由と更新後の説明文を Markdown 形式で整形する。
 */
function formatReviseComment(statement: FeatureStatement, reason: ChangeReason): string {
  const lines: string[] = [];
  lines.push("## Revision");
  lines.push("");
  lines.push(`**Reason**: ${reason.description}`);
  lines.push("");
  lines.push(statement.description);
  return lines.join("\n");
}

/**
 * Feature の管理ユースケース。
 *
 * Feature の定義、再定義、Epic への割り当て/解除、特定、検索の操作を提供する。
 * 全ての変更操作は Gateway 層で実行可能な Plan を返す。
 */
export interface FeatureUseCase {
  /**
   * 新規 Feature を定義する。
   * parentEpic が指定された場合、その Epic が存在すること（id が undefined でないこと）を検証する。
   * identifier.id が undefined の場合、createItem を含む Plan を返す。
   */
  define(
    identifier: FeatureIdentifier,
    statement: FeatureStatement,
    parentEpic?: EpicIdentifier,
  ): Plan;
  /**
   * 既存 Feature を再定義する。
   * updateItem で内容を更新し、addComment で変更理由を記録する Plan を返す。
   * identifier.id が undefined の場合はエラー。
   */
  revise(
    identifier: FeatureIdentifier,
    statement: FeatureStatement,
    reason: ChangeReason,
  ): Plan;
  /**
   * Feature を Epic に割り当てる。
   * updateItem で parentEpic フィールドを設定する Plan を返す。
   * epic.id が undefined の場合はエラー（存在しない Epic への割り当てを防止）。
   */
  assignToEpic(identifier: FeatureIdentifier, epic: EpicIdentifier): Plan;
  /**
   * Feature の Epic 割り当てを解除する。
   * updateItem で parentEpic フィールドをクリアする Plan を返す。
   * identifier.id が undefined の場合はエラー。
   */
  unassignFromEpic(identifier: FeatureIdentifier): Plan;
  /**
   * Feature を ID で特定する。
   * findItem を含む Plan を返す。identifier.id が undefined の場合はエラー。
   */
  find(identifier: FeatureIdentifier): Plan;
  /**
   * Feature を検索条件で検索する。
   * searchItems を含む Plan を返す。実際の検索は Gateway 層が実行する。
   */
  search(condition: FeatureSearchCondition): Plan;
}

export const featureUseCase: FeatureUseCase = {
  define(identifier, statement, parentEpic): Plan {
    assertTitleNonEmpty(identifier.title, "Feature title");
    assertStringNonEmpty(statement.description, "FeatureStatement description");
    if (parentEpic) {
      assertIdDefined(parentEpic.id, "assign feature to an epic without id");
    }
    return {
      summary: `Define feature: ${identifier.title.value}`,
      steps: [{
        entity: "Feature",
        operation: "create",
        params: {
          title: identifier.title.value,
          body: formatFeatureBody(statement, parentEpic?.id),
          ...(parentEpic?.id ? { parentEpic: parentEpic.id } : {}),
        },
      }],
    };
  },

  revise(identifier, statement, reason): Plan {
    assertTitleNonEmpty(identifier.title, "Feature title");
    assertStringNonEmpty(statement.description, "FeatureStatement description");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    assertIdDefined(identifier.id, "revise a feature");
    return {
      summary: `Revise feature: ${identifier.title.value}`,
      steps: [
        {
          entity: "Feature",
          operation: "update",
          params: {
            itemId: identifier.id,
            title: identifier.title.value,
            body: formatFeatureBody(statement),
          },
        },
        {
          entity: "Feature",
          operation: "comment",
          params: {
            body: formatReviseComment(statement, reason),
          },
        },
      ],
    };
  },

  assignToEpic(identifier, epic): Plan {
    assertIdDefined(identifier.id, "assign a feature to an epic");
    assertIdDefined(epic.id, "assign a feature to an epic without id");
    return {
      summary: `Assign feature ${identifier.title.value} to epic ${epic.title.value}`,
      steps: [{
        entity: "Feature",
        operation: "update",
        params: {
          itemId: identifier.id,
          parentEpic: epic.id,
        },
      }],
    };
  },

  unassignFromEpic(identifier): Plan {
    assertIdDefined(identifier.id, "unassign a feature from an epic");
    return {
      summary: `Unassign feature ${identifier.title.value} from epic`,
      steps: [{
        entity: "Feature",
        operation: "update",
        params: {
          itemId: identifier.id,
          parentEpic: undefined,
        },
      }],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Feature title");
    assertIdDefined(identifier.id, "find a feature");
    return {
      summary: `Find feature: ${identifier.title.value}`,
      steps: [{ entity: "Feature", operation: "view", params: { itemId: identifier.id } }],
    };
  },

  search(condition: FeatureSearchCondition): Plan {
    return {
      summary: condition.describe().summary,
      steps: condition.describe().steps,
    };
  },
};
