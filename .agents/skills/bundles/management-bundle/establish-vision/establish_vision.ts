#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify } from "../../../../core/domain/types.ts";
import type { EntityScope, Outcomes, VisionStatement } from "../../../../core/domain/types.ts";
import { visionUseCase } from "../../../../core/domain/vision-usecase.ts";
import { PlanGatewayAdapter } from "../../../../core/gateway/plan-gateway-adapter.ts";
import { readJsonFromStdin } from "../../../../core/shared/io/io.ts";

interface EstablishVisionInput {
  title: string;
  scope: EntityScope;
  targetAudience: string;
  value: string;
  differentiator: string;
  outcomes: { title: string; description: string }[];
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: ["dry-run"],
    alias: { "dry-run": "d" },
  });

  const input = await readJsonFromStdin<EstablishVisionInput>();
  const identifier = identify(input.scope, input.title);
  const statement: VisionStatement = {
    targetAudience: input.targetAudience,
    value: input.value,
    differentiator: input.differentiator,
  };
  const outcomes: Outcomes = { items: input.outcomes };

  const plan = visionUseCase.establish(identifier, statement, outcomes);

  if (args["dry-run"]) {
    console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
    Deno.exit(0);
  }

  const gateway = new PlanGatewayAdapter(input.scope.owner, input.scope.repository);
  const result = await gateway.execute(plan);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  main();
}
