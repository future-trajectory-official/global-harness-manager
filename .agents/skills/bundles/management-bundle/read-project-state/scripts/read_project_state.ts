#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { epicUseCase } from "../../../../../core/domain/epic-usecase.ts";
import { featureUseCase } from "../../../../../core/domain/feature-usecase.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import {
  type EntityType,
  identify,
  type Plan,
  sprintRef,
  type StepResult,
  UNKNOWN_SCOPE,
} from "../../../../../core/domain/types.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

/** read-project-state スキルの入力。 */
export interface ReadProjectStateInput {
  entityType: EntityType;
  operation: "search" | "find";
  params: Record<string, unknown>;
}

/** 検索条件の構築に使用する describe() 付きオブジェクト。 */
interface DescribeCondition {
  summary: string;
  steps: readonly {
    readonly entity: string;
    readonly operation: string;
    readonly params: Record<string, unknown>;
  }[];
}

/** describe() の戻り値を Plan 型へ適合させる。 */
function toPlan(condition: DescribeCondition): Plan {
  return {
    summary: condition.summary,
    steps: condition.steps.map((s) => ({
      entity: s.entity,
      operation: s.operation,
      params: s.params,
    })) as unknown as Plan["steps"],
  };
}

/** Plan を実行できる UseCase。 */
export interface Executable {
  executePlan(plan: Plan): Promise<{
    stepResults: readonly StepResult[];
    getStep(entity: string, operation: string): StepResult | undefined;
  }>;
}

/**
 * ディスパッチする操作ハンドラ。
 * - useCase: Plan 実行用の UseCase（getUseCaseFor の二重マップを廃止）
 * - search: 一覧検索。単一インスタンスEntityでは未提供
 * - find: 詳細閲覧
 * - notImplemented: Gateway 未登録で未実装の Entity を明示するフラグ
 */
interface OperationDispatch {
  useCase: Executable;
  search?: (params: Record<string, unknown>) => Plan;
  find: (params: Record<string, unknown>) => Plan;
  notImplemented?: boolean;
}

/**
 * search 条件の共通構築。entityType と labelType から describe() 付き条件を作る。
 * statusSupported が false の Entity に status が指定された場合は明示エラーを投げる
 * （黙殺して全件を返す誤動作を防ぐ）。
 */
function buildSearchCondition(
  entityType: string,
  labelType: string,
  params: Record<string, unknown>,
  options: { statusSupported: boolean },
): DescribeCondition {
  if (params.status !== undefined && params.status !== "" && !options.statusSupported) {
    throw new Error(
      `INVALID_INPUT: status filter is not supported for ${entityType} search. Use state instead.`,
    );
  }
  const filters: string[] = [];
  const stepParams: Record<string, unknown> = { labelType };
  const specs: readonly [key: string, template: string][] = [
    ["status", `status="%s"`],
    ["sprintNumber", `sprint=%s`],
    ["state", `state="%s"`],
    ["keyword", `keyword="%s"`],
  ];
  for (const [key, template] of specs) {
    const value = params[key];
    if (value !== undefined && value !== "") {
      filters.push(template.replace("%s", String(value)));
      stepParams[key] = value;
    }
  }
  const summary = filters.length > 0
    ? `Search ${entityType}: ${filters.join(", ")}`
    : `Search ${entityType}: (all)`;
  return {
    summary,
    steps: [{
      entity: entityType,
      operation: "search",
      params: stepParams,
    }],
  };
}

/** params から code（Issue 番号）をエイリアス優先順で解決する。 */
function resolveCode(
  params: Record<string, unknown>,
  aliases: readonly string[],
): string | undefined {
  for (const key of aliases) {
    const value = params[key];
    if (value !== undefined && value !== "") {
      return String(value);
    }
  }
  return undefined;
}

/**
 * find の入力から identifier を構築する。
 * code は Issue 番号の主キー。id のみの指定は Gateway で解決できないため拒否する。
 */
function toIdentifier(
  entity: string,
  title: string,
  params: Record<string, unknown>,
) {
  const id = params.id !== undefined ? String(params.id) : undefined;
  const code = resolveCode(params, ["itemId", "code"]);
  if (code === undefined) {
    throw new Error(`INVALID_INPUT: find for ${entity} requires itemId (Issue number)`);
  }
  return identify(UNKNOWN_SCOPE, title, id, code);
}

/** StepResult をチャット表示用に整形する。 */
function formatStepResult(step: StepResult): unknown {
  return {
    operation: step.operation,
    success: step.success,
    ...(step.itemId !== undefined ? { itemId: step.itemId } : {}),
    ...(step.nodeId !== undefined ? { nodeId: step.nodeId } : {}),
    ...(step.output !== undefined ? { output: step.output } : {}),
    ...(step.error !== undefined ? { error: step.error } : {}),
  };
}

/** 業務前提（単一インスタンス）により search を提供しない Entity のエラー。 */
function unsupportedSearch(entity: string): never {
  throw new Error(
    `search is not supported for ${entity}: single-instance by business rule. Use find instead.`,
  );
}

/** 検索・閲覧とも不可の非エンティティ（Scope）専用エラー。 */
function invalidScopeOperation(): never {
  throw new Error("INVALID_INPUT: Scope is not a searchable/findable entity");
}

/** EntityType ごとのディスパッチ定義（Strategyパターン）。 */
const dispatcher: Record<EntityType, OperationDispatch> = {
  Vision: {
    useCase: visionUseCase,
    find: (params) => visionUseCase.find(toIdentifier("Vision", "Vision", params)),
  },
  ProductGoal: {
    useCase: productGoalUseCase,
    find: (params) => productGoalUseCase.find(toIdentifier("ProductGoal", "Product Goal", params)),
  },
  Epic: {
    useCase: epicUseCase,
    search: (params) => {
      const condition = buildSearchCondition("Epic", "Epic", params, { statusSupported: false });
      return epicUseCase.search({ describe: () => toPlan(condition) });
    },
    find: (params) => epicUseCase.find(toIdentifier("Epic", "Epic", params)),
  },
  Feature: {
    useCase: featureUseCase,
    search: (params) => {
      const condition = buildSearchCondition("Feature", "Feature", params, {
        statusSupported: false,
      });
      return featureUseCase.search({ describe: () => toPlan(condition) });
    },
    find: (params) => featureUseCase.find(toIdentifier("Feature", "Feature", params)),
  },
  ProductBacklogItem: {
    useCase: productBacklogItemUseCase,
    search: (params) => {
      const condition = buildSearchCondition("ProductBacklogItem", "PBI", params, {
        statusSupported: true,
      });
      return productBacklogItemUseCase.search({ describe: () => toPlan(condition) });
    },
    find: (params) => productBacklogItemUseCase.find(toIdentifier("PBI", "PBI", params)),
  },
  WorkPackage: {
    useCase: workPackageUseCase,
    search: (params) => {
      const condition = buildSearchCondition("WorkPackage", "WP", params, {
        statusSupported: true,
      });
      return workPackageUseCase.search({ describe: () => toPlan(condition) });
    },
    find: (params) => workPackageUseCase.find(toIdentifier("WP", "WP", params)),
  },
  Sprint: {
    useCase: sprintUseCase,
    search: (params) => {
      const state = String(params.state ?? "all");
      if (!["open", "closed", "all"].includes(state)) {
        throw new Error(`INVALID_INPUT: Sprint state must be one of "open", "closed", "all"`);
      }
      return sprintUseCase.search({ state: state as "open" | "closed" | "all" });
    },
    find: (params) => {
      const code = resolveCode(params, ["itemId", "code", "number"]);
      if (code === undefined) {
        return sprintUseCase.find();
      }
      const number = parseInt(code, 10);
      if (!Number.isInteger(number) || number < 1) {
        throw new Error(`INVALID_INPUT: Sprint number must be a positive integer`);
      }
      return sprintUseCase.find(sprintRef(number, undefined, String(number)));
    },
  },
  Review: {
    useCase: reviewUseCase,
    search: (params) => {
      const condition = buildSearchCondition("Review", "Review", params, {
        statusSupported: false,
      });
      return reviewUseCase.search({ describe: () => toPlan(condition) });
    },
    find: (params) => reviewUseCase.find(toIdentifier("Review", "Review", params)),
  },
  Retrospective: {
    useCase: retrospectiveUseCase,
    notImplemented: true,
    search: (params) => {
      const condition = buildSearchCondition("Retrospective", "Retrospective", params, {
        statusSupported: false,
      });
      return retrospectiveUseCase.search({ describe: () => toPlan(condition) });
    },
    find: (params) =>
      retrospectiveUseCase.find(toIdentifier("Retrospective", "Retrospective", params)),
  },
  Scope: {
    useCase: {
      executePlan: () => {
        throw new Error("unreachable");
      },
    },
    search: () => invalidScopeOperation(),
    find: () => invalidScopeOperation(),
  },
};

/** 入力から操作対象の Plan を取得する。 */
export function buildPlan(input: ReadProjectStateInput): Plan {
  if (input.operation !== "search" && input.operation !== "find") {
    throw new Error(`INVALID_INPUT: operation must be "search" or "find"`);
  }
  const dispatch = dispatcher[input.entityType];
  if (!dispatch) {
    throw new Error(`INVALID_INPUT: Unknown entityType: ${input.entityType}`);
  }
  if (input.operation === "search") {
    if (!dispatch.search) {
      unsupportedSearch(input.entityType);
    }
    return dispatch.search(input.params);
  }
  return dispatch.find(input.params);
}

/** Plan を実行し、指定操作の StepResult を整形して返す。 */
async function executeAndFormat(
  input: ReadProjectStateInput,
  plan: Plan,
): Promise<unknown> {
  const dispatch = dispatcher[input.entityType];
  if (dispatch.notImplemented) {
    return { success: false, error: `${input.entityType}: not yet implemented in gateway layer` };
  }
  const result = await dispatch.useCase.executePlan(plan);
  const step = result.getStep(input.entityType, input.operation === "find" ? "view" : "search");
  if (step) {
    if (step.error) {
      return { success: false, error: step.error, step: formatStepResult(step) };
    }
    return { success: true, step: formatStepResult(step) };
  }
  return { success: true, stepResults: result.stepResults };
}

async function main(): Promise<void> {
  try {
    const input = await readJsonFromStdin<ReadProjectStateInput>();
    const plan = buildPlan(input);
    const output = await executeAndFormat(input, plan);
    console.log(JSON.stringify(output, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
