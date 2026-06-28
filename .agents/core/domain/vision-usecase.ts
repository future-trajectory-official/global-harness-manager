import type { ChangeReason, Outcomes, Plan, VisionIdentifier, VisionStatement } from "./types.ts";
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
            body: formatVisionBody(),
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
      steps: [{ operation: "findItem", params: { itemId: identifier.id, type: "Vision" } }],
    };
  },
};
