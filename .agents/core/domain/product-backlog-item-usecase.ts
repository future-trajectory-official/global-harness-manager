import type { EntityScope, ExecutionResult, Plan, Step, StepResult } from "./types.ts";
import type {
  ChangeReason,
  FeatureIdentifier,
  ProcessAnalysis,
  ProductBacklogItemIdentifier,
  ProductBacklogItemSearchCondition,
  ProductBacklogItemStatement,
  SizeVariance,
  SprintIdentifier,
  WorkPackageData,
  WorkPackageIdentifier,
} from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";
import { executePlan as _executePlan } from "./plan-executor.ts";

let _gateway: PlanGateway | undefined;

export function initProductBacklogItemUseCase(gateway: PlanGateway): void {
  _gateway = gateway;
}

function scopeStep(identifier: { scope: EntityScope }): Step {
  return {
    entity: "Scope" as const,
    operation: "resolve" as const,
    params: { ...identifier.scope },
  };
}
import {
  assertIdDefined,
  assertReferenceDefined,
  assertStringNonEmpty,
  assertTitleNonEmpty,
} from "./validation.ts";

function assertWpDataNonEmpty(wps: WorkPackageData[] | undefined): void {
  if (!wps || wps.length === 0) {
    throw new Error("INVALID_INPUT: At least one WorkPackageData is required");
  }
}

function formatPbiBody(statement: ProductBacklogItemStatement): string {
  const lines: string[] = [];
  lines.push("## Summary");
  lines.push("");
  lines.push(statement.summary);
  if (statement.artifacts) {
    lines.push("");
    lines.push("## Artifacts");
    for (const cat of statement.artifacts.categories) {
      lines.push("");
      lines.push(`### ${cat.name}`);
      for (const item of cat.items) {
        lines.push(`- ${item.description}`);
      }
    }
  }
  if (statement.proofMethod) {
    lines.push("");
    lines.push("## Proof Method");
    lines.push("");
    lines.push(statement.proofMethod);
  }
  return lines.join("\n");
}

function formatReviseComment(statement: ProductBacklogItemStatement, reason: ChangeReason): string {
  const lines: string[] = [];
  lines.push("## History");
  lines.push("");
  lines.push("| # | 変更前 | 変更後 | 変更理由 |");
  lines.push("| - | ------ | ------ | -------- |");
  lines.push(`| 1 | — | ${statement.summary} | ${reason.description} |`);
  return lines.join("\n");
}

export interface ProductBacklogItemUseCase {
  propose(
    identifier: ProductBacklogItemIdentifier,
    statement: ProductBacklogItemStatement,
    parentFeature?: FeatureIdentifier,
  ): Plan;

  revise(
    identifier: ProductBacklogItemIdentifier,
    statement: ProductBacklogItemStatement,
    reason: ChangeReason,
  ): Plan;

  commit(
    identifier: ProductBacklogItemIdentifier,
    sprint: SprintIdentifier,
    childWorkPackageIdentifiers?: WorkPackageIdentifier[],
  ): Plan;

  start(identifier: ProductBacklogItemIdentifier): Plan;

  complete(identifier: ProductBacklogItemIdentifier): Plan;

  archive(identifier: ProductBacklogItemIdentifier): Plan;

  defineAcceptanceCriteria(
    identifier: ProductBacklogItemIdentifier,
    workPackages: WorkPackageData[],
  ): Plan;

  assignToFeature(
    identifier: ProductBacklogItemIdentifier,
    feature: FeatureIdentifier,
  ): Plan;

  unassignFromFeature(
    identifier: ProductBacklogItemIdentifier,
  ): Plan;

  estimateSize(
    identifier: ProductBacklogItemIdentifier,
    variance: SizeVariance,
  ): Plan;

  confirmSize(
    identifier: ProductBacklogItemIdentifier,
    variance: SizeVariance,
  ): Plan;

  recordAnalysis(
    identifier: ProductBacklogItemIdentifier,
    analysis: ProcessAnalysis,
  ): Plan;

  analyzeEffort(identifier: ProductBacklogItemIdentifier): Plan;

  find(identifier: ProductBacklogItemIdentifier): Plan;

  search(condition: ProductBacklogItemSearchCondition): Plan;
}

export const productBacklogItemUseCase: ProductBacklogItemUseCase & {
  executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  >;
} = {
  propose(identifier, statement, parentFeature): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertStringNonEmpty(statement.summary, "PBI statement summary");
    if (parentFeature) {
      assertIdDefined(parentFeature.id, "assign PBI to a feature without id");
    }
    return {
      summary: `Propose PBI: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "propose",
        params: {
          title: identifier.title.value,
          body: formatPbiBody(statement),
          ...(parentFeature?.code ? { parentFeature: parentFeature.code } : {}),
        },
      }],
    };
  },

  revise(identifier, statement, reason): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertStringNonEmpty(statement.summary, "PBI statement summary");
    assertIdDefined(identifier.id, "revise a PBI");
    assertStringNonEmpty(reason.description, "ChangeReason description");
    return {
      summary: `Revise PBI: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "ProductBacklogItem",
          operation: "update",
          params: {
            itemId: identifier.code,
            title: identifier.title.value,
            body: formatPbiBody(statement),
          },
        },
        {
          entity: "ProductBacklogItem",
          operation: "comment",
          params: {
            itemId: identifier.code,
            body: formatReviseComment(statement, reason),
          },
        },
      ],
    };
  },

  commit(identifier, sprint, childWorkPackageIdentifiers?): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "commit a PBI");
    const childWpSteps: Step[] = (childWorkPackageIdentifiers ?? []).map((wpId) => ({
      entity: "WorkPackage" as const,
      operation: "commit" as const,
      params: {
        itemId: wpId.code,
        stage: "todo",
        state: "open",
        sprint: sprint.title.value,
      },
    }));
    return {
      summary: `Commit PBI ${identifier.title.value} to ${sprint.title.value}` +
        (childWorkPackageIdentifiers?.length
          ? ` + ${childWorkPackageIdentifiers.length} WP(s)`
          : ""),
      steps: [
        scopeStep(identifier),
        {
          entity: "ProductBacklogItem",
          operation: "commit",
          params: {
            itemId: identifier.code,
            stage: "todo",
            state: "open",
            sprint: sprint.title.value,
          },
        },
        ...childWpSteps,
      ],
    };
  },

  start(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "start a PBI");
    return {
      summary: `Start PBI: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "ProductBacklogItem",
          operation: "start",
          params: {
            itemId: identifier.code,
            stage: "inProgress",
            state: "open",
          },
        },
      ],
    };
  },

  complete(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "complete a PBI");
    return {
      summary: `Complete PBI: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "ProductBacklogItem",
          operation: "complete",
          params: {
            itemId: identifier.code,
            stage: "done",
            state: "open",
          },
        },
      ],
    };
  },

  archive(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "archive a PBI");
    return {
      summary: `Archive PBI: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        {
          entity: "ProductBacklogItem",
          operation: "archive",
          params: {
            itemId: identifier.code,
            stage: "done",
            state: "closed",
          },
        },
      ],
    };
  },

  defineAcceptanceCriteria(identifier, workPackages): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "define acceptance criteria for a PBI");
    assertWpDataNonEmpty(workPackages);
    return {
      summary: `Define acceptance criteria for: ${identifier.title.value}`,
      steps: [
        scopeStep(identifier),
        ...workPackages.map((wp) => ({
          entity: "ProductBacklogItem" as const,
          operation: "defineAcceptanceCriteria" as const,
          params: {
            title: wp.identifier.title.value,
            parentPbi: identifier.code,
            body: wp.statement.acceptanceCriteria.items.map((ac) =>
              `- [ ] AC${ac.number}: ${ac.description}`
            ).join("\n"),
          },
        })),
      ],
    };
  },

  assignToFeature(identifier, feature): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "assign a PBI to a feature");
    assertIdDefined(feature.id, "assign a PBI to a feature without id");
    return {
      summary: `Assign PBI ${identifier.title.value} to feature ${feature.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "assignToFeature",
        params: {
          itemId: identifier.code,
          parentFeature: feature.code,
        },
      }],
    };
  },

  unassignFromFeature(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "unassign a PBI from a feature");
    return {
      summary: `Unassign PBI ${identifier.title.value} from feature`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "unassignFromFeature",
        params: {
          itemId: identifier.code,
          parentFeature: undefined,
        },
      }],
    };
  },

  estimateSize(identifier, variance): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "estimate size of a PBI");
    return {
      summary: `Estimate size for PBI: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "estimateSize",
        params: {
          itemId: identifier.code,
          sizeEstimate: variance.estimate?.toString(),
        },
      }],
    };
  },

  confirmSize(identifier, variance): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "confirm size of a PBI");
    return {
      summary: `Confirm size for PBI: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "confirmSize",
        params: {
          itemId: identifier.code,
          sizeActual: variance.actual?.toString(),
          sizeVarianceReason: variance.varianceReason,
        },
      }],
    };
  },

  recordAnalysis(identifier, analysis): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "record analysis for a PBI");
    assertStringNonEmpty(analysis.planningReview, "planningReview");
    const body = JSON.stringify({
      planning_variance_review: analysis.planningReview,
      execution_variance_review: analysis.executionReview,
      improvement_suggestions: analysis.improvementSuggestions,
    });
    return {
      summary: `Record analysis for PBI: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "recordAnalysis",
        params: {
          itemId: identifier.code,
          body,
        },
      }],
    };
  },

  find(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertReferenceDefined(identifier.id, identifier.code, "find a PBI");
    return {
      summary: `Find PBI: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "view",
        params: {
          itemId: identifier.code,
        },
      }],
    };
  },

  analyzeEffort(identifier): Plan {
    assertTitleNonEmpty(identifier.title, "PBI title");
    assertIdDefined(identifier.id, "analyze effort for a PBI");
    return {
      summary: `Analyze effort for PBI: ${identifier.title.value}`,
      steps: [scopeStep(identifier), {
        entity: "ProductBacklogItem",
        operation: "analyzeEffort",
        params: {
          itemId: identifier.code,
        },
      }],
    };
  },

  search(condition): Plan {
    return {
      summary: condition.describe().summary,
      steps: [{
        entity: "Scope",
        operation: "resolve",
        params: { owner: "unknown", repository: "unknown" },
      }, ...condition.describe().steps],
    };
  },

  async executePlan(
    plan: Plan,
  ): Promise<
    ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
  > {
    if (!_gateway) {
      throw new Error(
        "ProductBacklogItemUseCase not initialized. Call initProductBacklogItemUseCase first.",
      );
    }
    return await _executePlan(plan, _gateway);
  },
};
