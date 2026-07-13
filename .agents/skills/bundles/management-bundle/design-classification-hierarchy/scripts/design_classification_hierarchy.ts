#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { epicUseCase } from "../../../../../core/domain/epic-usecase.ts";
import { featureUseCase } from "../../../../../core/domain/feature-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope, Plan } from "../../../../../core/domain/types.ts";
import type { PlanGateway } from "../../../../../core/domain/plan-gateway.ts";
import { executePlan } from "../../../../../core/domain/plan-executor.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

type Operation = "define-epic" | "define-feature" | "show-hierarchy";

interface DesignHierarchyInput {
  operation: Operation;
  title?: string;
  description?: string;
  parentEpicTitle?: string;
  parentEpicId?: string;
  epicId?: string;
  epicNumber?: string;
  scope?: EntityScope;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<DesignHierarchyInput>();
    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };

    let plan: Plan;

    switch (input.operation) {
      case "define-epic": {
        const identifier = identify(scope, input.title ?? "", input.epicId, input.epicNumber);
        plan = epicUseCase.define(identifier, { description: input.description ?? "" });
        break;
      }
      case "define-feature": {
        const featureId = identify(scope, input.title ?? "", input.epicId, input.epicNumber);
        const parentEpic = input.parentEpicId
          ? identify(scope, input.parentEpicTitle ?? "", input.parentEpicId)
          : undefined;
        plan = featureUseCase.define(
          featureId,
          { description: input.description ?? "" },
          parentEpic,
        );
        break;
      }
      case "show-hierarchy": {
        const epicId = identify(
          scope,
          input.title ?? "",
          input.epicId ?? input.epicNumber,
          input.epicNumber,
        );
        plan = epicUseCase.showHierarchy(epicId);
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
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
