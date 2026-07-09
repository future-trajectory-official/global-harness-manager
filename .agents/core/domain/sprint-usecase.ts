import type { ExecutionResult, Plan, SprintIdentifier } from "./types.ts";
import type { GoalStatement } from "./types.ts";
import { assertIdDefined, assertStringNonEmpty } from "./validation.ts";

function toMilestoneName(identifier: SprintIdentifier): string {
  return identifier.title.value;
}

export interface SprintUseCaseOptions {
  dryRun?: boolean;
  owner?: string;
  repository?: string;
}

async function execute(
  plan: Plan,
  owner: string,
  repository: string,
): Promise<ExecutionResult> {
  const { PlanGatewayAdapter } = await import("../gateway/plan-gateway-adapter.ts");
  const gateway = new PlanGatewayAdapter(owner, repository);
  return await gateway.execute(plan);
}

async function planOrExecute(
  plan: Plan,
  options?: SprintUseCaseOptions,
): Promise<Plan | ExecutionResult> {
  if (options?.dryRun || !options?.owner || !options?.repository) return plan;
  return await execute(plan, options.owner, options.repository);
}

export interface SprintUseCase {
  start(
    identifier: SprintIdentifier,
    options?: SprintUseCaseOptions,
  ): Promise<Plan | ExecutionResult>;
  end(
    identifier: SprintIdentifier,
    options?: SprintUseCaseOptions,
  ): Promise<Plan | ExecutionResult>;
  setGoal(
    identifier: SprintIdentifier,
    goal: GoalStatement,
    options?: SprintUseCaseOptions,
  ): Promise<Plan | ExecutionResult>;
  setDueDate(
    identifier: SprintIdentifier,
    dueDate: Date,
    options?: SprintUseCaseOptions,
  ): Promise<Plan | ExecutionResult>;
  find(
    identifier?: SprintIdentifier,
    options?: SprintUseCaseOptions,
  ): Promise<Plan | ExecutionResult>;
}

export const sprintUseCase: SprintUseCase = {
  async start(identifier, options) {
    return await planOrExecute({
      summary: `Start sprint: ${identifier.title.value}`,
      steps: [{
        entity: "Sprint",
        operation: "create",
        params: {
          title: toMilestoneName(identifier),
          description: toMilestoneName(identifier),
        },
      }],
    }, options);
  },

  async end(identifier, options) {
    assertIdDefined(identifier.id, "end a sprint");
    assertIdDefined(identifier.code, "end a sprint");
    return await planOrExecute({
      summary: `End sprint: ${identifier.title.value}`,
      steps: [{
        entity: "Sprint",
        operation: "endSprint",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
        },
      }],
    }, options);
  },

  async setGoal(identifier, goal, options) {
    assertStringNonEmpty(goal.description, "GoalStatement description");
    assertIdDefined(identifier.id, "set goal for a sprint");
    assertIdDefined(identifier.code, "set goal for a sprint");
    return await planOrExecute({
      summary: `Set goal for sprint: ${identifier.title.value}`,
      steps: [{
        entity: "Sprint",
        operation: "setGoal",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
          description: goal.description,
        },
      }],
    }, options);
  },

  async setDueDate(identifier, dueDate, options) {
    assertIdDefined(identifier.id, "set due date for a sprint");
    assertIdDefined(identifier.code, "set due date for a sprint");
    return await planOrExecute({
      summary: `Set due date for sprint: ${identifier.title.value}`,
      steps: [{
        entity: "Sprint",
        operation: "setDueDate",
        params: {
          itemId: identifier.code,
          title: toMilestoneName(identifier),
          dueDate: dueDate.toISOString(),
        },
      }],
    }, options);
  },

  async find(identifier?: SprintIdentifier, options?) {
    if (!identifier) {
      return {
        summary: "Find latest open sprint",
        steps: [
          { entity: "Sprint", operation: "search", params: { state: "open" } },
          { entity: "Sprint", operation: "view", params: {} },
        ],
      };
    }
    assertIdDefined(identifier.id, "find a sprint");
    assertIdDefined(identifier.code, "find a sprint");
    return await planOrExecute({
      summary: `Find sprint: ${identifier.title.value}`,
      steps: [{ entity: "Sprint", operation: "view", params: { itemId: identifier.code } }],
    }, options);
  },
};
