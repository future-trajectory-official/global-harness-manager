import { createDomainError } from "./domain-error.ts";
import type { EntityState, Stage } from "./types.ts";
import type { ProductBacklogItemData } from "./types.ts";
import { type EntityValidator, VALID } from "./entity-validator.ts";
import type { ValidationResult } from "./entity-validator.ts";

interface TransitionEntry {
  readonly operation: string;
  readonly from: {
    readonly stage: Stage;
    readonly state: EntityState;
  };
  readonly to: {
    readonly stage: Stage;
    readonly state: EntityState;
  };
}

/**
 * PBI 状態遷移テーブル。
 *
 * ## 状態定義
 *
 * - Stage: `"idea" | "todo" | "inProgress" | "done"` — 進行段階
 * - State: `"open" | "closed"` — Issue開閉
 *
 * ## 遷移ルール
 *
 * | 操作 | 元(status, state) | 先(status, state) |
 * |------|-------------------|-------------------|
 * | commit | (idea, open) | (todo, open) |
 * | start | (todo, open) | (inProgress, open) |
 * | complete | (inProgress, open) | (done, open) |
 * | archive | (done, open) | (done, closed) |
 */
const TRANSITIONS: readonly TransitionEntry[] = [
  {
    operation: "commit",
    from: { stage: "idea", state: "open" },
    to: { stage: "todo", state: "open" },
  },
  {
    operation: "start",
    from: { stage: "todo", state: "open" },
    to: { stage: "inProgress", state: "open" },
  },
  {
    operation: "complete",
    from: { stage: "inProgress", state: "open" },
    to: { stage: "done", state: "open" },
  },
  {
    operation: "archive",
    from: { stage: "done", state: "open" },
    to: { stage: "done", state: "closed" },
  },
];

/**
 * 操作が現在の状態から許可されているか検証する。
 * 不正な遷移の場合は DomainError(INVALID_STATE_TRANSITION) をスローする。
 *
 * @returns 遷移先の状態
 */
export function assertValidTransition(
  operation: string,
  stage: Stage,
  state: EntityState,
): { stage: Stage; state: EntityState } {
  for (const entry of TRANSITIONS) {
    if (
      entry.operation === operation &&
      entry.from.stage === stage &&
      entry.from.state === state
    ) {
      return entry.to;
    }
  }
  throw createDomainError(
    "INVALID_STATE_TRANSITION",
    `Cannot ${operation} from (${stage}, ${state})`,
    { operation, currentStage: stage, currentState: state },
  );
}

/**
 * PBI エンティティのバリデーター。
 *
 * 状態遷移ルールの検証を提供する。WP_a では以下も追加予定:
 * - 見積サイズの削除禁止
 * - effort の順序制約（initial ≤ planned ≤ actual）
 * - 不変条件（完了後の属性変更不可） etc.
 */
export const pbiValidator: EntityValidator<ProductBacklogItemData> = {
  validate(operation, from, to): ValidationResult {
    for (const entry of TRANSITIONS) {
      if (
        entry.operation === operation &&
        entry.from.stage === from.stage &&
        entry.from.state === from.state &&
        entry.to.stage === to.stage &&
        entry.to.state === to.state
      ) {
        return VALID;
      }
    }
    return {
      valid: false,
      errors: [
        `Invalid transition: ${operation} from (${from.stage}, ${from.state}) to (${to.stage}, ${to.state})`,
      ],
    };
  },
};
