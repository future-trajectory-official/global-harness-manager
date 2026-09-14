import type {
  EntityScope,
  ExecutionResult,
  Plan,
  SprintIdentifier,
  Step,
  StepResult,
} from "./types.ts";
import type { GoalStatement } from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";

let _gateway: PlanGateway | undefined;

export function initSprintUseCase(gateway: PlanGateway): void {
  _gateway = gateway;
}

function scopeStep(identifier: { scope: EntityScope }): Step {
  return {
    entity: "Scope" as const,
    operation: "resolve" as const,
    params: { ...identifier.scope },
  };
}
import { assertIdDefined, assertReferenceDefined, assertStringNonEmpty } from "./validation.ts";

function toMilestoneName(identifier: SprintIdentifier): string {
  return identifier.title.value;
}

/**
 * Sprint（マイルストーン）エンティティに対する全操作を定義するUseCaseインターフェース。
 *
 * 各メソッドはバリデーション後にPlan（実行計画）を返す。
 *
 * ## 識別子（identifier）の意味
 *
 * - `identifier.id` は GitHub node-id（グローバル識別子）、`identifier.code` はリポジトリ内識別子
 *   （Issue番号）を表す。
 * - 既存参照操作は `code`（Issue番号）で項目を特定する。Gateway層が `code` から node-id を
 *   内部解決して操作を行う。`id` を渡してもこの解決ステップは省かれず、
 *   パフォーマンスやAPI制限に問題が出るまで実装変更は行わない方針。
 * - 各操作の解決方法は操作ごとのJSDocに明記する。
 */
export interface SprintUseCase {
  start(identifier: SprintIdentifier): Plan;
  end(identifier: SprintIdentifier): Plan;
  setGoal(identifier: SprintIdentifier, goal: GoalStatement): Plan;
  setDueDate(identifier: SprintIdentifier, dueDate: Date): Plan;
  recordVelocity(identifier: SprintIdentifier, velocity: VelocityMetrics): Plan;
  search(condition?: SprintSearchCondition): Plan;
  find(identifier?: SprintIdentifier): Plan;
}

/** Sprint（マイルストーン）の検索条件。state 指定でマイルストーン一覧を解決する。 */
export interface SprintSearchCondition {
  state?: "open" | "closed" | "all";
}

/** スプリントベロシティの集計結果。Milestone description の `## Velocity` セクションに記録する。 */
export interface VelocityMetrics {
  sprintNumber: number;
  pbiCount: number;
  totalWeight: number;
  matchRate: number;
  summary: string;
}

export const sprintUseCase: SprintUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  start(identifier): Plan {
    return {
      summary: `Start sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "create",
        params: {
          title: toMilestoneName(identifier),
          description: toMilestoneName(identifier),
        },
      }],
    };
  },

  end(identifier): Plan {
    assertIdDefined(identifier.code, "end a sprint");
    return {
      summary: `End sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "endSprint",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
        },
      }],
    };
  },

  setGoal(identifier, goal): Plan {
    assertStringNonEmpty(goal.description, "GoalStatement description");
    assertIdDefined(identifier.code, "set goal for a sprint");
    return {
      summary: `Set goal for sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "setGoal",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
          description: goal.description,
        },
      }],
    };
  },

  setDueDate(identifier, dueDate): Plan {
    assertIdDefined(identifier.code, "set due date for a sprint");
    return {
      summary: `Set due date for sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "setDueDate",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
          dueDate: dueDate.toISOString(),
        },
      }],
    };
  },

  search(condition?: SprintSearchCondition): Plan {
    const state = condition?.state ?? "all";
    return {
      summary: `Search sprints: state=${state}`,
      steps: [
        {
          entity: "Scope",
          operation: "resolve",
          params: { owner: "unknown", repository: "unknown" },
        },
        { entity: "Sprint", operation: "search", params: { state } },
      ],
    };
  },

  find(identifier?: SprintIdentifier): Plan {
    if (!identifier) {
      return {
        summary: "Find latest open sprint",
        steps: [
          {
            entity: "Scope",
            operation: "resolve",
            params: { owner: "unknown", repository: "unknown" },
          },
          { entity: "Sprint", operation: "search", params: { state: "open" } },
          { entity: "Sprint", operation: "view", params: {} },
        ],
      };
    }
    assertReferenceDefined(identifier.id, identifier.code, "find a sprint");
    return {
      summary: `Find sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "view",
        params: { itemId: identifier.code },
      }],
    };
  },

  recordVelocity(identifier, velocity): Plan {
    assertIdDefined(identifier.code, "record velocity for a sprint");
    if (!Number.isInteger(velocity.sprintNumber) || velocity.sprintNumber < 1) {
      throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
    }
    if (
      !Number.isInteger(velocity.pbiCount) || !Number.isInteger(velocity.totalWeight) ||
      velocity.pbiCount < 0 || velocity.totalWeight < 0
    ) {
      throw new Error("INVALID_INPUT: pbiCount and totalWeight must be non-negative integers");
    }
    if (
      typeof velocity.matchRate !== "number" ||
      !Number.isFinite(velocity.matchRate) ||
      velocity.matchRate < 0 ||
      velocity.matchRate > 1
    ) {
      throw new Error("INVALID_INPUT: matchRate must be a number between 0 and 1");
    }
    if (typeof velocity.summary !== "string" || velocity.summary.trim() === "") {
      throw new Error("INVALID_INPUT: summary must not be empty");
    }
    return {
      summary: `Record velocity for sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "recordVelocity",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
          velocity,
        },
      }],
    };
  },

  async executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  > {
    if (!_gateway) throw new Error("SprintUseCase not initialized. Call initSprintUseCase first.");
    return await _executePlan(plan, _gateway);
  },
};
