import type { Plan } from "./types.ts";
import type { ChangeReason, GoalStatement, ProductGoalIdentifier } from "./types.ts";

function assertTitleNonEmpty(title: { value: string }, label: string): void {
  if (!title.value) {
    throw new Error(`INVALID_INPUT: ${label} must not be empty`);
  }
}

function assertStringNonEmpty(value: string, label: string): void {
  if (!value) {
    throw new Error(`INVALID_INPUT: ${label} must not be empty`);
  }
}

function assertIdDefined(id: string | undefined, label: string): void {
  if (id === undefined) {
    throw new Error(
      `INVALID_INPUT: Cannot ${label} that has not been created yet (id is undefined)`,
    );
  }
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Body: 変更履歴テーブル */
export function formatGoalBody(version: number, statement: GoalStatement): string {
  const lines: string[] = [];
  lines.push("## History");
  lines.push("");
  lines.push("| 日付 | バージョン | 概要 |");
  lines.push("| ---- | ---------- | ---- |");
  lines.push(`| ${formatDate()} | ${version} | ${statement.description.slice(0, 40)}... |`);
  return lines.join("\n");
}

/** Body: pivot時の変更履歴追記行 */
export function formatGoalHistoryLine(version: number, reason: string): string {
  return `| ${formatDate()} | ${version} | ${reason} |\n`;
}

/** Comment: バージョン管理された本文（L2準拠） */
export function formatGoalComment(statement: GoalStatement, version: number): string {
  const lines: string[] = [];
  lines.push(`# Version: ${version}`);
  lines.push("");
  lines.push("## Goal");
  lines.push("");
  lines.push(statement.description);
  return lines.join("\n");
}

export interface ProductGoalUseCase {
  set(identifier: ProductGoalIdentifier, statement: GoalStatement): Plan;
  pivot(identifier: ProductGoalIdentifier, statement: GoalStatement, reason: ChangeReason): Plan;
  find(identifier: ProductGoalIdentifier): Plan;
}

export const productGoalUseCase: ProductGoalUseCase = {
  set(identifier, statement): Plan {
    assertTitleNonEmpty(identifier.title, "ProductGoal title");
    assertStringNonEmpty(statement.description, "GoalStatement description");
    return {
      summary: `Set product goal: ${identifier.title.value}`,
      steps: [
        {
          operation: "createItem",
          params: {
            title: identifier.title.value,
            type: "Goal",
            body: formatGoalBody(1, statement),
          },
        },
        {
          operation: "addComment",
          params: {
            body: formatGoalComment(statement, 1),
          },
        },
      ],
    };
  },

  pivot(identifier, statement, reason): Plan {
    assertTitleNonEmpty(identifier.title, "ProductGoal title");
    assertStringNonEmpty(statement.description, "GoalStatement description");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    assertIdDefined(identifier.id, "pivot a product goal");
    return {
      summary: `Pivot product goal: ${identifier.title.value}`,
      steps: [
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            title: identifier.title.value,
            type: "Goal",
            bodyAppend: formatGoalHistoryLine(2, reason.description),
          },
        },
        {
          operation: "addComment",
          params: {
            body: formatGoalComment(statement, 2),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "ProductGoal title");
    assertIdDefined(identifier.id, "find a product goal");
    return {
      summary: `Find product goal: ${identifier.title.value}`,
      steps: [{
        operation: "findItem",
        params: {
          itemId: identifier.id,
          type: "Goal",
        },
      }],
    };
  },
};
