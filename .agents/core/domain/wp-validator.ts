import { type EntityValidator, VALID } from "./entity-validator.ts";
import type { ValidationResult } from "./entity-validator.ts";
import { assertValidTransition } from "./wp-state-machine.ts";
import { isDomainError } from "./domain-error.ts";
import type { WorkPackageData } from "./types.ts";

function noStageChangeRule(
  from: WorkPackageData,
  to: WorkPackageData,
): ValidationResult {
  if (from.stage !== to.stage || from.state !== to.state) {
    return {
      valid: false,
      errors: ["この操作ではstage/stateを変更できません"],
    };
  }
  return VALID;
}

function isDoneOpen(from: WorkPackageData): boolean {
  return from.stage === "done" && from.state === "open";
}

function isInProgressOpen(from: WorkPackageData): boolean {
  return from.stage === "inProgress" && from.state === "open";
}

function doneOpenOnlyRule(from: WorkPackageData, label: string): ValidationResult {
  if (!isDoneOpen(from)) {
    return {
      valid: false,
      errors: [`${label}はWP完了後(done, open)のみ可能です`],
    };
  }
  return VALID;
}

function notDoneNorClosedRule(from: WorkPackageData, label: string): ValidationResult {
  if (from.state === "closed") {
    return {
      valid: false,
      errors: [`Archive済みのWPには${label}できません`],
    };
  }
  if (from.stage === "done") {
    return {
      valid: false,
      errors: [`完了済み(done)のWPには${label}できません`],
    };
  }
  return VALID;
}

function ideaOrTodoOpenOnlyRule(from: WorkPackageData, label: string): ValidationResult {
  if (from.state === "closed") {
    return {
      valid: false,
      errors: [`Archive済みのWPには${label}できません`],
    };
  }
  if (from.stage !== "idea" && from.stage !== "todo") {
    return {
      valid: false,
      errors: [`${label}はideaまたはtodoのWPのみ可能です`],
    };
  }
  return VALID;
}

function stageTransitionRule(
  operation: string,
  from: WorkPackageData,
  to: WorkPackageData,
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

function processEvidenceComplete(from: WorkPackageData): boolean {
  const ev = from.processEvidence;
  if (!ev) return false;
  if (ev.effort?.initialEstimate === undefined) return false;
  if (ev.effort?.plannedEstimate === undefined) return false;
  if (ev.effort?.actual === undefined) return false;
  if (!ev.processAnalysis?.planningReview) return false;
  if (!ev.processAnalysis?.executionReview) return false;
  if (!ev.processAnalysis?.improvementSuggestions) return false;
  return true;
}

export type WpOperation =
  | "commit"
  | "start"
  | "complete"
  | "archive"
  | "revise"
  | "define"
  | "assignToProductBacklogItem"
  | "unassignFromProductBacklogItem"
  | "estimateInitialEffort"
  | "estimatePlannedEffort"
  | "recordActualEffort"
  | "recordAnalysis"
  | "recordSessionMetrics"
  | "find"
  | "search";

type RuleFn = (
  operation: string,
  from: WorkPackageData,
  to: WorkPackageData,
) => ValidationResult;

const ROUTE: Record<WpOperation, RuleFn> = {
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
          "プロセス分析が記録されていないWPはアーカイブできません。先に recordAnalysis を実行してください",
        ],
      };
    }
    return VALID;
  },
  revise(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return notDoneNorClosedRule(from, "編集");
  },
  define: () => VALID,
  assignToProductBacklogItem: () => VALID,
  unassignFromProductBacklogItem: () => VALID,
  estimateInitialEffort(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return ideaOrTodoOpenOnlyRule(from, "初期見積もりの設定");
  },
  estimatePlannedEffort(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    if (!isInProgressOpen(from)) {
      return {
        valid: false,
        errors: ["計画見積もりの設定は着手後(inProgress, open)のみ可能です"],
      };
    }
    const planned = to.processEvidence?.effort?.plannedEstimate;
    const initial = from.processEvidence?.effort?.initialEstimate;
    if (planned !== undefined && initial !== undefined && planned < initial) {
      return {
        valid: false,
        errors: ["計画見積もりは初期見積もり以上である必要があります"],
      };
    }
    return VALID;
  },
  recordActualEffort(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return doneOpenOnlyRule(from, "実績工数の記録");
  },
  recordAnalysis(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    return doneOpenOnlyRule(from, "プロセス分析の記録");
  },
  recordSessionMetrics(_op, from, to) {
    const base = noStageChangeRule(from, to);
    if (!base.valid) return base;
    const doneCheck = doneOpenOnlyRule(from, "セッションメトリクスの記録");
    if (!doneCheck.valid) return doneCheck;
    if (!processEvidenceComplete(from)) {
      return {
        valid: false,
        errors: [
          "セッションメトリクスの記録には、初期見積・計画見積・実績工数・プロセス分析の全項目が完了している必要があります",
        ],
      };
    }
    return VALID;
  },
  find: () => VALID,
  search: () => VALID,
};

/**
 * WPエンティティに対する全操作の事前条件バリデーター。
 *
 * operation文字列で適切な検証関数にルーティングし、状態遷移ルールと
 * 値の制約ルールを一元的に検証する。Gateway層（PlanGateway.execute）
 * からPlan実行直前に呼び出され、不正な操作を検出してPlan全体を中断するために使用する。
 */
export const wpValidator: EntityValidator<WorkPackageData> = {
  validate(operation, from, to): ValidationResult {
    const rule = ROUTE[operation as WpOperation];
    if (rule === undefined) {
      console.warn(`[WpValidator] 未知のoperationです: "${operation}" — VALIDを返します`);
      return VALID;
    }
    return rule(operation, from, to);
  },
};
