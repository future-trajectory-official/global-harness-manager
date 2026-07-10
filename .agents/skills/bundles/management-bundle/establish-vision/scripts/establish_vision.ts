#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope, Outcomes, VisionStatement } from "../../../../../core/domain/types.ts";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface EstablishVisionInput {
  elevatorPitch?: string;
  passion?: string;
  targetAudience: string;
  value: string;
  differentiator: string;
  outcomes: { title: string; description: string }[];
  scope?: EntityScope;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<EstablishVisionInput>();
    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };
    const identifier = identify(scope, `Vision of ${scope.repository}`);
    const statement: VisionStatement = {
      elevatorPitch: input.elevatorPitch,
      passion: input.passion,
      targetAudience: input.targetAudience,
      value: input.value,
      differentiator: input.differentiator,
    };
    const outcomes: Outcomes = { items: input.outcomes };

    const plan = visionUseCase.establish(identifier, statement, outcomes);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
      return;
    }

    const { PlanGatewayAdapter } = await import(
      "../../../../../core/gateway/plan-gateway-adapter.ts"
    );
    const gateway = new PlanGatewayAdapter();
    const result = await gateway.execute(plan);
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
