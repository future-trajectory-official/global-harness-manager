import { type EntityValidator, VALID } from "./entity-validator.ts";
import type { ValidationResult } from "./entity-validator.ts";
import { assertValidTransition } from "./pbi-state-machine.ts";
import { isDomainError } from "./domain-error.ts";
import type { ProductBacklogItemData } from "./types.ts";

/**
 * 状態遷移を伴わない操作が、from と to で stage/state を変更していないことを確認する。
 */
function noStageChangeRule(
  from: ProductBacklogItemData,
  to: ProductBacklogItemData,
): ValidationResult {
  if (from.stage !== to.stage || from.state !== to.state) {
    return {
      valid: false,
      errors: [
        "この操作ではstage/stateを変更できません",
      ],
    };
  }
  return VALID;
}

function isDoneOpen(from: ProductBacklogItemData): boolean {
  return from.stage === "done" && from.state === "open";
}

/** from が (done, open) 以外の場合に禁止する汎用ルール。 */
function doneOpenOnlyRule(from: ProductBacklogItemData, label: string): ValidationResult {
  if (!isDoneOpen(from)) {
    return {
      valid: false,
      errors: [`${label}はPBI完了後(done, open)のみ可能です`],
    };
  }
  return VALID;
}

/** from が done または closed の場合に禁止する汎用ルール。 */
function notDoneNorClosedRule(from: ProductBacklogItemData, label: string): ValidationResult {
  if (from.state === "closed") {
    return {
      valid: false,
      errors: [`Archive済みのPBIには${label}できません`],
    };
  }
  if (from.stage === "done") {
    return {
      valid: false,
      errors: [`完了済み(done)のPBIには${label}できません`],
    };
  }
  return VALID;
}

/**
 * PBI操作の種別。
 * ProductBacklogItemUseCase の全publicメソッド名に対応する。
 */
export type PbiOperation =
  | "commit"
  | "start"
  | "complete"
  | "archive"
  | "estimateSize"
  | "confirmSize"
  | "recordAnalysis"
  | "revise"
  | "defineAcceptanceCriteria"
  | "assignToFeature"
  | "unassignFromFeature"
  | "propose"
  | "find"
  | "search";

type RuleFn = (
  operation: string,
  from: ProductBacklogItemData,
  to: ProductBacklogItemData,
) => ValidationResult;

/**
 * commit/start/complete/archive の状態遷移を TRANSITIONS テーブルに照合して検証する。
 * 不正な遷移の場合、具体的な理由をerrorsに含めて返す。
 */
function stageTransitionRule(
  operation: string,
  from: ProductBacklogItemData,
  to: ProductBacklogItemData,
): ValidationResult {
  try {
    const expected = assertValidTransition(operation, from.stage, from.state);
    if (expected.stage !== to.stage || expected.state !== to.state) {
      return {
        valid: false,
        errors: [
          `不正な遷移です: ${operation} (${from.stage}, ${from.state}) → (${to.stage}, ${to.state})`,
        ],
      };
    }
    return VALID;
  } catch (e) {
    if (isDomainError(e) && e.code === "INVALID_STATE_TRANSITION") {
      return {
        valid: false,
        errors: [
          `不正な遷移です: ${operation} (${from.stage}, ${from.state}) → (${to.stage}, ${to.state})`,
        ],
      };
    }
    throw e;
  }
}

/** PbiOperation ごとのバリデーション関数を格納するルーティングテーブル。 */
const ROUTE: Record<PbiOperation, RuleFn> = {
  commit: stageTransitionRule,
  start: stageTransitionRule,
  complete: stageTransitionRule,
  archive(op, from, to) {
    const transition = stageTransitionRule(op, from, to);
    if (!transition.valid) return transition;
    if (!from.processEvidence) {
      return {
        valid: false,
        errors: [
          "プロセス分析が記録されていないPBIはアーカイブできません。先に recordAnalysis を実行してください",
        ],
      };
    }
    return VALID;
  },
  estimateSize(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    if (from.state === "closed") {
      return {
        valid: false,
        errors: ["Archive済みのPBIには見積サイズを設定できません"],
      };
    }
    if (from.stage === "inProgress" || from.stage === "done") {
      return {
        valid: false,
        errors: [
          `Statusが${
            from.stage === "inProgress" ? "InProgress" : "Done"
          }のPBIには見積サイズを設定できません。着手前にのみ設定可能です`,
        ],
      };
    }
    return VALID;
  },
  confirmSize(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return doneOpenOnlyRule(from, "実感サイズの設定");
  },
  recordAnalysis(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return doneOpenOnlyRule(from, "プロセス分析の記録");
  },
  revise(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return notDoneNorClosedRule(from, "編集");
  },
  defineAcceptanceCriteria(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return notDoneNorClosedRule(from, "受入基準の定義");
  },
  assignToFeature: () => VALID,
  unassignFromFeature: () => VALID,
  propose: () => VALID,
  find: () => VALID,
  search: () => VALID,
};

/**
 * PBIエンティティに対する全操作の事前条件バリデーター。
 *
 * operation文字列で適切な検証関数にルーティングし、状態遷移ルール（AC2）と
 * 値の制約ルール（AC3）を一元的に検証する。Gateway層（PlanGateway.execute）
 * からPlan実行直前に呼び出され、不正な操作を検出してPlan全体を中断するために使用する。
 */
export const pbiValidator: EntityValidator<ProductBacklogItemData> = {
  /**
   * 指定されたoperationが、fromからtoへの遷移として妥当かを検証する。
   *
   * @param operation - 検証対象の操作名（PbiOperation のいずれか）
   * @param from - 操作前のエンティティ状態
   * @param to - 操作後の目標状態
   * @returns 検証結果。valid===false の場合、errors に日本語の禁止理由が含まれる
   */
  validate(operation, from, to): ValidationResult {
    const rule = ROUTE[operation as PbiOperation];
    if (rule === undefined) {
      console.warn(`[PbiValidator] 未知のoperationです: "${operation}" — VALIDを返します`);
      return VALID;
    }
    return rule(operation, from, to);
  },
};
