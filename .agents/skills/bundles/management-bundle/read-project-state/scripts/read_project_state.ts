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
interface ReadProjectStateInput {
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

/** ディスパッチする操作ハンドラ。search は単一インスタンスEntityでは未提供。 */
interface OperationDispatch {
  search?: (params: Record<string, unknown>) => Plan;
  find: (params: Record<string, unknown>) => Plan;
}

/** 検索条件の共通構築。entityType と labelType から describe() 付き条件を作る。 */
function buildSearchCondition(
  entityType: string,
  labelType: string,
  params: Record<string, unknown>,
): DescribeCondition {
  const filters: string[] = [];
  const stepParams: Record<string, unknown> = { labelType };
  if (params.status !== undefined && params.status !== "") {
    filters.push(`status="${params.status}"`);
    stepParams.status = params.status;
  }
  if (params.sprintNumber !== undefined && params.sprintNumber !== "") {
    filters.push(`sprint=${params.sprintNumber}`);
    stepParams.sprintNumber = params.sprintNumber;
  }
  if (params.state !== undefined && params.state !== "") {
    filters.push(`state="${params.state}"`);
    stepParams.state = params.state;
  }
  if (params.keyword !== undefined && params.keyword !== "") {
    filters.push(`keyword="${params.keyword}"`);
    stepParams.keyword = params.keyword;
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

/** find の入力から identifier を構築する。code は Issue 番号。 */
function toIdentifier(
  entity: string,
  title: string,
  params: Record<string, unknown>,
) {
  const id = params.id !== undefined ? String(params.id) : undefined;
  const code = params.itemId !== undefined
    ? String(params.itemId)
    : params.code !== undefined
    ? String(params.code)
    : undefined;
  if (code === undefined && id === undefined) {
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

/** Gateway 未登録エラーを明示的な未実装エラーへ変換する。 */
function normalizeExecutionError(entity: string, error: string): string {
  if (entity === "Retrospective" && /No handler registered/.test(error)) {
    return `Retrospective: not yet implemented in gateway layer`;
  }
  return error;
}

/** EntityType ごとのディスパッチ定義（Strategyパターン）。 */
const dispatcher: Record<EntityType, OperationDispatch> = {
  Vision: {
    find: (params) => visionUseCase.find(toIdentifier("Vision", "Vision", params)),
  },
  ProductGoal: {
    find: (params) => productGoalUseCase.find(toIdentifier("ProductGoal", "Product Goal", params)),
  },
  Epic: {
    search: (params) => {
      const condition = buildSearchCondition("Epic", "Epic", params);
      return epicUseCase.search({
        keyword: params.keyword !== undefined ? String(params.keyword) : undefined,
        describe: () => toPlan(condition),
      });
    },
    find: (params) => epicUseCase.find(toIdentifier("Epic", "Epic", params)),
  },
  Feature: {
    search: (params) => {
      const condition = buildSearchCondition("Feature", "Feature", params);
      return featureUseCase.search({
        keyword: params.keyword !== undefined ? String(params.keyword) : undefined,
        describe: () => toPlan(condition),
      });
    },
    find: (params) => featureUseCase.find(toIdentifier("Feature", "Feature", params)),
  },
  ProductBacklogItem: {
    search: (params) => {
      const condition = buildSearchCondition("ProductBacklogItem", "PBI", params);
      return productBacklogItemUseCase.search({
        keyword: params.keyword !== undefined ? String(params.keyword) : undefined,
        sprintNumber: params.sprintNumber !== undefined ? Number(params.sprintNumber) : undefined,
        status: params.status !== undefined ? String(params.status) : undefined,
        state: params.state !== undefined ? String(params.state) : undefined,
        describe: () => toPlan(condition),
      });
    },
    find: (params) => productBacklogItemUseCase.find(toIdentifier("PBI", "PBI", params)),
  },
  WorkPackage: {
    search: (params) => {
      const condition = buildSearchCondition("WorkPackage", "WP", params);
      return workPackageUseCase.search({
        keyword: params.keyword !== undefined ? String(params.keyword) : undefined,
        sprintNumber: params.sprintNumber !== undefined ? Number(params.sprintNumber) : undefined,
        status: params.status !== undefined ? String(params.status) : undefined,
        describe: () => toPlan(condition),
      });
    },
    find: (params) => workPackageUseCase.find(toIdentifier("WP", "WP", params)),
  },
  Sprint: {
    find: (params) => {
      const code = params.itemId !== undefined
        ? String(params.itemId)
        : params.code !== undefined
        ? String(params.code)
        : params.number !== undefined
        ? String(params.number)
        : undefined;
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
    search: (params) => {
      const condition = buildSearchCondition("Review", "Review", params);
      return reviewUseCase.search({
        sprintNumber: params.sprintNumber !== undefined ? Number(params.sprintNumber) : undefined,
        describe: () => toPlan(condition),
      });
    },
    find: (params) => reviewUseCase.find(toIdentifier("Review", "Review", params)),
  },
  Retrospective: {
    search: (params) => {
      const condition = buildSearchCondition("Retrospective", "Retrospective", params);
      return retrospectiveUseCase.search({
        sprintNumber: params.sprintNumber !== undefined ? Number(params.sprintNumber) : undefined,
        describe: () => toPlan(condition),
      });
    },
    find: (params) =>
      retrospectiveUseCase.find(toIdentifier("Retrospective", "Retrospective", params)),
  },
  Scope: {
    find: () => {
      throw new Error("INVALID_INPUT: Scope is not a searchable/findable entity");
    },
  },
};

/** 入力から操作対象の Plan を取得する。 */
function buildPlan(input: ReadProjectStateInput): Plan {
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
  const useCase = getUseCaseFor(input.entityType);
  const result = await useCase.executePlan(plan);
  const step = result.getStep(input.entityType, input.operation === "find" ? "view" : "search");
  if (step) {
    const normalized = normalizeExecutionError(input.entityType, step.error ?? "");
    if (step.error) {
      return { success: false, error: normalized, step: formatStepResult(step) };
    }
    return { success: true, step: formatStepResult(step) };
  }
  return { success: true, stepResults: result.stepResults };
}

interface Executable {
  executePlan(plan: Plan): Promise<{
    stepResults: readonly StepResult[];
    getStep(entity: string, operation: string): StepResult | undefined;
  }>;
}

function getUseCaseFor(entity: EntityType): Executable {
  const useCases: Record<EntityType, Executable> = {
    Vision: visionUseCase,
    ProductGoal: productGoalUseCase,
    Epic: epicUseCase,
    Feature: featureUseCase,
    ProductBacklogItem: productBacklogItemUseCase,
    WorkPackage: workPackageUseCase,
    Sprint: sprintUseCase,
    Review: reviewUseCase,
    Retrospective: retrospectiveUseCase,
    Scope: {
      executePlan: async () => {
        await Promise.resolve();
        return {
          stepResults: [],
          getStep: () => undefined,
        };
      },
    },
  };
  return useCases[entity];
}

async function main(): Promise<void> {
  try {
    const input = await readJsonFromStdin<ReadProjectStateInput>();
    if (input.operation !== "search" && input.operation !== "find") {
      throw new Error(`INVALID_INPUT: operation must be "search" or "find"`);
    }
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
