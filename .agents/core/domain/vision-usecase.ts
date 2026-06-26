import type { Plan } from "./types.ts";
import type { ChangeReason, Outcomes, VisionIdentifier, VisionStatement } from "./types.ts";

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
export function formatVisionBody(
  version: number,
  statement: VisionStatement,
): string {
  const lines: string[] = [];
  lines.push("## History");
  lines.push("");
  lines.push("| 日付 | バージョン | 概要 |");
  lines.push("| ---- | ---------- | ---- |");
  lines.push(`| ${formatDate()} | ${version} | ${statement.targetAudience.slice(0, 40)}... |`);
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

export const visionUseCase: VisionUseCase = {
  establish(identifier, statement, outcomes): Plan {
    assertTitleNonEmpty(identifier.title, "Vision title");
    assertStringNonEmpty(statement.targetAudience, "targetAudience");
    assertStringNonEmpty(statement.value, "value");
    assertStringNonEmpty(statement.differentiator, "differentiator");
    return {
      summary: `Establish vision: ${identifier.title.value}`,
      steps: [
        {
          operation: "createItem",
          params: {
            title: identifier.title.value,
            type: "Vision",
            body: formatVisionBody(1, statement),
          },
        },
        {
          operation: "addComment",
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
        {
          operation: "updateItem",
          params: {
            itemId: identifier.id,
            title: identifier.title.value,
            type: "Vision",
            bodyAppend: formatVisionHistoryLine(2, reason.description),
          },
        },
        {
          operation: "addComment",
          params: {
            body: formatVisionComment(statement, outcomes, 2),
          },
        },
      ],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "Vision title");
    assertIdDefined(identifier.id, "find a vision");
    return {
      summary: `Find vision: ${identifier.title.value}`,
      steps: [{
        operation: "findItem",
        params: {
          itemId: identifier.id,
          type: "Vision",
        },
      }],
    };
  },
};
