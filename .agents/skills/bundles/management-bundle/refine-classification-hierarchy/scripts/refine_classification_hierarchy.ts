#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import {
  epicUseCase,
  formatAllEpicHierarchies,
  formatEpicHierarchy,
} from "../../../../../core/domain/epic-usecase.ts";
import { featureUseCase } from "../../../../../core/domain/feature-usecase.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope, EpicData, List, Plan } from "../../../../../core/domain/types.ts";
import type { PlanGateway } from "../../../../../core/domain/plan-gateway.ts";
import { executePlan } from "../../../../../core/domain/plan-executor.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

type Operation =
  | "show-hierarchy"
  | "revise-epic"
  | "revise-feature"
  | "assign-feature-to-epic"
  | "unassign-feature-from-epic"
  | "assign-pbi-to-feature"
  | "unassign-pbi-from-feature";

interface RefineHierarchyInput {
  operation: Operation;
  title?: string;
  description?: string;
  epicId?: string;
  epicNumber?: string;
  featureId?: string;
  featureNumber?: string;
  pbiId?: string;
  pbiNumber?: string;
  parentEpicId?: string;
  parentFeatureId?: string;
  reason?: string;
  scope?: EntityScope;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<RefineHierarchyInput>();
    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };

    let plan: Plan;

    switch (input.operation) {
      case "show-hierarchy": {
        if (input.epicId || input.epicNumber) {
          const epicId = identify(
            scope,
            input.title ?? "",
            (input.epicId ?? input.epicNumber) as string | undefined,
            input.epicNumber ?? input.epicId,
          );
          plan = epicUseCase.showHierarchy(epicId);
        } else {
          plan = epicUseCase.showHierarchyAll();
        }
        break;
      }
      case "revise-epic": {
        const epicId = identify(scope, input.title ?? "", input.epicId, input.epicNumber);
        plan = epicUseCase.revise(
          epicId,
          { description: input.description ?? "" },
          { description: input.reason ?? "Revised during sprint start refinement" },
        );
        break;
      }
      case "revise-feature": {
        const featureId = identify(
          scope,
          input.title ?? "",
          input.featureId ?? input.featureNumber,
          input.featureNumber,
        );
        plan = featureUseCase.revise(
          featureId,
          { description: input.description ?? "" },
          { description: input.reason ?? "Revised during sprint start refinement" },
        );
        break;
      }
      case "assign-feature-to-epic": {
        const featureId = identify(
          scope,
          input.title ?? "",
          input.featureId ?? input.featureNumber,
          input.featureNumber,
        );
        const parentEpic = input.parentEpicId
          ? identify(scope, input.parentEpicId, input.parentEpicId)
          : undefined;
        if (!parentEpic) {
          throw new Error("INVALID_INPUT: parentEpicId is required for assign-feature-to-epic");
        }
        plan = featureUseCase.assignToEpic(featureId, parentEpic);
        break;
      }
      case "unassign-feature-from-epic": {
        const featureId = identify(
          scope,
          input.title ?? "",
          input.featureId ?? input.featureNumber,
          input.featureNumber,
        );
        plan = featureUseCase.unassignFromEpic(featureId);
        break;
      }
      case "assign-pbi-to-feature": {
        const pbiId = identify(
          scope,
          input.title ?? "",
          input.pbiId ?? input.pbiNumber,
          input.pbiNumber,
        );
        const parentFeature = input.parentFeatureId
          ? identify(scope, input.parentFeatureId, input.parentFeatureId)
          : undefined;
        if (!parentFeature) {
          throw new Error("INVALID_INPUT: parentFeatureId is required for assign-pbi-to-feature");
        }
        plan = productBacklogItemUseCase.assignToFeature(pbiId, parentFeature);
        break;
      }
      case "unassign-pbi-from-feature": {
        const pbiId = identify(
          scope,
          input.title ?? "",
          input.pbiId ?? input.pbiNumber,
          input.pbiNumber,
        );
        plan = productBacklogItemUseCase.unassignFromFeature(pbiId);
        break;
      }
      default:
        throw new Error(`Unknown operation: ${input.operation}`);
    }

    if (args["dry-run"]) {
      const stepsInfo = plan.steps.map((s) => ({
        entity: s.entity,
        operation: s.operation,
        params: s.params,
      }));
      console.log(JSON.stringify({ summary: plan.summary, steps: stepsInfo }, null, 2));
      return;
    }

    const { PlanGatewayAdapter } = await import(
      "../../../../../core/gateway/plan-gateway-adapter.ts"
    );
    const gateway: PlanGateway = new PlanGatewayAdapter();
    const result = await executePlan(plan, gateway);
    if (input.operation === "show-hierarchy") {
      const isAll = !input.epicId && !input.epicNumber;
      if (isAll) {
        const epicsResult = result.getStep("Epic", "showHierarchyAll");
        const allData = epicsResult?.output as List<EpicData> | undefined;
        if (allData) {
          console.log(formatAllEpicHierarchies([...allData.items]));
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      } else {
        const epicsResult = result.getStep("Epic", "showHierarchy");
        const epicData = epicsResult?.output as EpicData | undefined;
        if (epicData) {
          console.log(formatEpicHierarchy(epicData));
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
