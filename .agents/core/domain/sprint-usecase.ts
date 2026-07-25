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
import { assertIdDefined, assertStringNonEmpty } from "./validation.ts";

function toMilestoneName(identifier: SprintIdentifier): string {
  return identifier.title.value;
}

export interface SprintUseCase {
  start(identifier: SprintIdentifier): Plan;
  end(identifier: SprintIdentifier): Plan;
  setGoal(identifier: SprintIdentifier, goal: GoalStatement): Plan;
  setDueDate(identifier: SprintIdentifier, dueDate: Date): Plan;
  find(identifier?: SprintIdentifier): Plan;
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
    assertIdDefined(identifier.code, "find a sprint");
    return {
      summary: `Find sprint: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "Sprint",
        operation: "view",
        params: { itemId: identifier.code },
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
