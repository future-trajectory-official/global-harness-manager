import type { Plan } from "./types.ts";
import type { ChangeReason, EpicIdentifier, EpicSearchCondition, EpicStatement } from "./types.ts";

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

function formatEpicBody(statement: EpicStatement): string {
  const lines: string[] = [];
  lines.push("## Description");
  lines.push("");
  lines.push(statement.description);
  return lines.join("\n");
}

function formatReviseComment(statement: EpicStatement, reason: ChangeReason): string {
  const lines: string[] = [];
  lines.push("## Revision");
  lines.push("");
  lines.push(`**Reason**: ${reason.description}`);
  lines.push("");
  lines.push(statement.description);
  return lines.join("\n");
}

export interface EpicUseCase {
  define(identifier: EpicIdentifier, statement: EpicStatement): Plan;
  revise(identifier: EpicIdentifier, statement: EpicStatement, reason: ChangeReason): Plan;
  find(identifier: EpicIdentifier): Plan;
  search(condition: EpicSearchCondition): Plan;
}

export const epicUseCase: EpicUseCase = {
  define(identifier, statement): Plan {
    assertTitleNonEmpty(identifier.title, "Epic title");
    assertStringNonEmpty(statement.description, "EpicStatement description");
    return {
      summary: `Define epic: ${identifier.title.value}`,
      steps: [{
        operation: "createItem",
        params: {
          title: identifier.title.value,
          type: "Epic",
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
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            title: identifier.title.value,
            type: "Epic",
            body: formatEpicBody(statement),
          },
        },
        {
          operation: "addComment",
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
      steps: [{
        operation: "findItem",
        params: {
          itemId: identifier.id,
          type: "Epic",
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
