import { type EntityValidator, VALID } from "./entity-validator.ts";
import type { ValidationResult } from "./entity-validator.ts";
import type { RetrospectiveData } from "./types.ts";

/** Retrospective の状態が open であることを検証する汎用ルール。 */
function openStateOnlyRule(from: RetrospectiveData, label: string): ValidationResult {
  if (from.state !== "open") {
    return {
      valid: false,
      errors: [`${label}はopen状態のRetrospectiveのみ可能です`],
    };
  }
  return VALID;
}

/** Retrospective エンティティに対する全操作種別。RetrospectiveUseCase の公開メソッド名に対応する。 */
export type RetrospectiveOperation =
  | "plan"
  | "recordSprintKpt"
  | "recordSprintMetrics"
  | "archive"
  | "view"
  | "search";

type RuleFn = (
  operation: string,
  from: RetrospectiveData,
  to: RetrospectiveData,
) => ValidationResult;

/** RetrospectiveOperation ごとのバリデーション関数を格納するルーティングテーブル。 */
const ROUTE: Record<RetrospectiveOperation, RuleFn> = {
  plan: () => VALID,

  recordSprintKpt(_op, from, _to) {
    return openStateOnlyRule(from, "スプリントKPTの記録");
  },

  recordSprintMetrics(_op, from, _to) {
    return openStateOnlyRule(from, "スプリントメトリクスの記録");
  },

  archive(_op, from, _to) {
    const openCheck = openStateOnlyRule(from, "アーカイブ");
    if (!openCheck.valid) return openCheck;
    if (!from.kpta) {
      return {
        valid: false,
        errors: ["KPTAが未設定のRetrospectiveはアーカイブできません"],
      };
    }
    if (!from.metrics) {
      return {
        valid: false,
        errors: ["metricsが未設定のRetrospectiveはアーカイブできません"],
      };
    }
    return VALID;
  },

  view: () => VALID,
  search: () => VALID,
};

/**
 * Retrospective エンティティに対する全操作の事前条件バリデーター。
 *
 * operation文字列で適切な検証関数にルーティングし、状態ルール（openのみ許可）と
 * 値の制約ルール（KPTA・metrics未設定のarchive禁止）を一元的に検証する。
 * Gateway層（PlanGateway.execute）からPlan実行直前に呼び出される。
 */
export const retrospectiveValidator: EntityValidator<RetrospectiveData> = {
  validate(operation, from, to): ValidationResult {
    const rule = ROUTE[operation as RetrospectiveOperation];
    if (rule === undefined) {
      console.warn(
        `[RetrospectiveValidator] 未知のoperationです: "${operation}" — VALIDを返します`,
      );
      return VALID;
    }
    return rule(operation, from, to);
  },
};
