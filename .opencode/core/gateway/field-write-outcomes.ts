import type { StepResult } from "../domain/types.ts";
import type { FieldRef } from "./field-registry.ts";

export interface FieldWrite {
  field: FieldRef;
  value: string;
}

export interface FieldWriteOutcomes {
  completed: string[];
  errors: string[];
}

/**
 * 複数のProject V2 field書込結果を集約し、部分成功と失敗理由を保持する。
 * @param writes - field書込の要求一覧
 * @param results - Promise.allSettledで収集した各setter結果
 * @returns 完了field名と失敗field名・理由
 */
export function collectFieldWriteOutcomes(
  writes: readonly FieldWrite[],
  results: readonly PromiseSettledResult<StepResult>[],
): FieldWriteOutcomes {
  const completed: string[] = [];
  const errors: string[] = [];

  for (let index = 0; index < writes.length; index++) {
    const fieldName = writes[index].field.fieldName;
    const result = results[index];
    if (!result) {
      errors.push(`${fieldName}: missing write result`);
    } else if (result.status === "rejected") {
      errors.push(
        `${fieldName}: ${
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        }`,
      );
    } else if (result.value.success) {
      completed.push(fieldName);
    } else {
      errors.push(`${fieldName}: ${result.value.error ?? "unknown error"}`);
    }
  }

  return { completed, errors };
}

/**
 * field書込の部分成功を明示した失敗メッセージを組み立てる。
 * @param summary - operationと対象を含むメッセージ
 * @param outcomes - 集約済みのfield書込結果
 * @returns 完了fieldと失敗fieldを含む詳細メッセージ
 */
export function formatPartialFieldWriteError(
  summary: string,
  outcomes: FieldWriteOutcomes,
): string {
  const completed = outcomes.completed.length > 0
    ? ` Completed fields: ${outcomes.completed.join(", ")}.`
    : " No fields completed successfully.";
  return `${summary}.${completed} Failed fields: ${outcomes.errors.join("; ")}`;
}
