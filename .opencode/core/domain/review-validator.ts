import { type EntityValidator, VALID } from "./entity-validator.ts";
import type { ValidationResult } from "./entity-validator.ts";
import type { ReviewData } from "./types.ts";

/** Review の状態が open であることを検証する汎用ルール。 */
function openStateOnlyRule(from: ReviewData, label: string): ValidationResult {
  if (from.state !== "open") {
    return {
      valid: false,
      errors: [`${label}はopen状態のReviewのみ可能です`],
    };
  }
  return VALID;
}

/** ACグループの全判定が unchecked でないことを検証する。report 時に使用する。 */
function allJudgmentsNotUnchecked(
  groups: readonly { readonly acJudgments: readonly { readonly judgment: string }[] }[],
  label: string,
): ValidationResult {
  for (const group of groups) {
    for (const ac of group.acJudgments) {
      if (ac.judgment === "unchecked") {
        return {
          valid: false,
          errors: [`${label}にuncheckedの判定が含まれています`],
        };
      }
    }
  }
  return VALID;
}

/** Review エンティティに対する全操作種別。ReviewUseCase の公開メソッド名に対応する。 */
export type ReviewOperation =
  | "plan"
  | "revise"
  | "report"
  | "archive"
  | "find"
  | "search";

type RuleFn = (
  operation: string,
  from: ReviewData,
  to: ReviewData,
) => ValidationResult;

/** ReviewOperation ごとのバリデーション関数を格納するルーティングテーブル。 */
const ROUTE: Record<ReviewOperation, RuleFn> = {
  plan: () => VALID,

  revise(_op, from, to) {
    const openCheck = openStateOnlyRule(from, "編集");
    if (!openCheck.valid) return openCheck;

    const errors: string[] = [];
    for (const fromGroup of from.plannedAcGroups) {
      const toGroup = to.plannedAcGroups.find(
        (g) => g.pbiNumber === fromGroup.pbiNumber && g.wpNumber === fromGroup.wpNumber,
      );
      if (!toGroup) {
        errors.push(
          `PBI#${fromGroup.pbiNumber} WP#${fromGroup.wpNumber} のACグループが削除されています。論理削除(judgment=removed)のみ許可されます`,
        );
        continue;
      }
      for (const fromAc of fromGroup.acJudgments) {
        const toAc = toGroup.acJudgments.find((a) => a.number === fromAc.number);
        if (!toAc) {
          errors.push(
            `AC${fromAc.number}が削除されています。論理削除(judgment=removed)のみ許可されます`,
          );
          continue;
        }
        if (
          fromAc.description !== toAc.description ||
          (fromAc.evidence !== undefined && toAc.evidence !== fromAc.evidence)
        ) {
          errors.push(
            `AC${fromAc.number}: 既存ACの変更は論理削除(judgment=removed)のみ許可されます`,
          );
        }
      }
    }
    if (errors.length > 0) return { valid: false, errors };
    return VALID;
  },

  report(_op, from, to) {
    const openCheck = openStateOnlyRule(from, "報告");
    if (!openCheck.valid) return openCheck;

    if (to.plannedAcGroups.length === 0) {
      return {
        valid: false,
        errors: ["報告には少なくとも1つのplannedAcGroupが必要です"],
      };
    }

    const planCheck = allJudgmentsNotUnchecked(to.plannedAcGroups, "plannedAcGroups");
    if (!planCheck.valid) return planCheck;

    if (to.postPlanAcGroups) {
      const postCheck = allJudgmentsNotUnchecked(to.postPlanAcGroups, "postPlanAcGroups");
      if (!postCheck.valid) return postCheck;
    } else if (from.postPlanAcGroups) {
      return {
        valid: false,
        errors: ["一度設定されたpostPlanAcGroupsをnullに戻せません"],
      };
    }
    return VALID;
  },

  archive(_op, from, _to) {
    const openCheck = openStateOnlyRule(from, "アーカイブ");
    if (!openCheck.valid) return openCheck;
    if (!from.overallResult) {
      return {
        valid: false,
        errors: ["overallResultが未設定のReviewはアーカイブできません"],
      };
    }
    return VALID;
  },

  find: () => VALID,
  search: () => VALID,
};

/**
 * Review エンティティに対する全操作の事前条件バリデーター。
 *
 * operation文字列で適切な検証関数にルーティングし、状態ルール（openのみ許可）と
 * 値の制約ルール（ACの論理削除のみ許可、unchecked判定の禁止等）を一元的に検証する。
 * Gateway層（PlanGateway.execute）からPlan実行直前に呼び出される。
 */
export const reviewValidator: EntityValidator<ReviewData> = {
  validate(operation, from, to): ValidationResult {
    const rule = ROUTE[operation as ReviewOperation];
    if (rule === undefined) {
      console.warn(`[ReviewValidator] 未知のoperationです: "${operation}" — VALIDを返します`);
      return VALID;
    }
    return rule(operation, from, to);
  },
};
