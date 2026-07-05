#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify, sprintId } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewPlanInput, ReviewPlanPbi } from "../../../../../core/domain/review-usecase.ts";
import { PlanGatewayAdapter } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { ConfigGatewayAdapter } from "../../../../../core/gateway/config-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface PlanSprintReviewInput {
  scope?: EntityScope;
  sprintNumber: number;
  reviewTitle?: string;
  sprintGoal?: string;
  pbis: ReviewPlanPbi[];
}

function validateInput(input: PlanSprintReviewInput): void {
  if (
    input.sprintNumber == null || !Number.isInteger(input.sprintNumber) || input.sprintNumber < 1
  ) {
    throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
  }
}

export function toPlanInput(input: PlanSprintReviewInput): ReviewPlanInput {
  return {
    sprintGoal: input.sprintGoal,
    pbis: input.pbis,
  };
}

async function resolveScope(): Promise<EntityScope> {
  const config = new ConfigGatewayAdapter("", "");
  return await config.resolveScope();
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<PlanSprintReviewInput>();
    validateInput(input);

    const scope = input.scope ?? await resolveScope();
    const sprint = sprintId(scope, input.sprintNumber);
    const reviewTitle = input.reviewTitle ?? `Sprint ${input.sprintNumber} Review`;
    const identifier = identify(scope, reviewTitle);
    const planInput = toPlanInput(input);

    const plan = reviewUseCase.plan(identifier, sprint, planInput);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
      return;
    }

    const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
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
