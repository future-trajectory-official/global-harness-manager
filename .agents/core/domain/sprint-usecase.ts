import type { Plan, SprintIdentifier } from "./types.ts";
import type { GoalStatement } from "./types.ts";
import { assertIdDefined, assertStringNonEmpty } from "./validation.ts";

function toMilestoneName(identifier: SprintIdentifier): string {
  return identifier.title.value;
}

export interface SprintUseCase {
  start(identifier: SprintIdentifier): Plan;
  end(identifier: SprintIdentifier): Plan;
  setGoal(identifier: SprintIdentifier, goal: GoalStatement): Plan;
  setDueDate(identifier: SprintIdentifier, dueDate: Date): Plan;
  find(identifier: SprintIdentifier): Plan;
}

export const sprintUseCase: SprintUseCase = {
  start(identifier): Plan {
    return {
      summary: `Start sprint: ${identifier.title.value}`,
      steps: [{
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
    assertIdDefined(identifier.id, "end a sprint");
    assertIdDefined(identifier.code, "end a sprint");
    return {
      summary: `End sprint: ${identifier.title.value}`,
      steps: [{
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
    assertIdDefined(identifier.id, "set goal for a sprint");
    assertIdDefined(identifier.code, "set goal for a sprint");
    return {
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
    };
  },

  setDueDate(identifier, dueDate): Plan {
    assertIdDefined(identifier.id, "set due date for a sprint");
    assertIdDefined(identifier.code, "set due date for a sprint");
    return {
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
    };
  },

  find(identifier): Plan {
    assertIdDefined(identifier.id, "find a sprint");
    assertIdDefined(identifier.code, "find a sprint");
    return {
      summary: `Find sprint: ${identifier.title.value}`,
      steps: [{ entity: "Sprint", operation: "view", params: { itemId: identifier.code } }],
    };
  },
};
