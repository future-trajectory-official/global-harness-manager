#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify, sprintId } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { ReviewPlanInput, ReviewPlanPbi } from "../../../../../core/domain/review-usecase.ts";
import type { PlanGateway } from "../../../../../core/domain/plan-gateway.ts";
import { executePlan } from "../../../../../core/domain/plan-executor.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface PlanSprintReviewInput {
  sprintNumber: number;
  reviewTitle?: string;
  sprintGoal?: string;
  pbis: ReviewPlanPbi[];
  scope?: EntityScope;
}

export function toPlanInput(input: PlanSprintReviewInput): ReviewPlanInput {
  return {
    sprintGoal: input.sprintGoal,
    pbis: input.pbis,
  };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<PlanSprintReviewInput>();
    if (
      input.sprintNumber == null || !Number.isInteger(input.sprintNumber) || input.sprintNumber < 1
    ) {
      throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
    }

    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };
    const sprint = sprintId(scope, input.sprintNumber);
    const reviewTitle = input.reviewTitle ?? `Sprint ${input.sprintNumber} Review`;
    const identifier = identify(scope, reviewTitle);
    const planInput = toPlanInput(input);

    const plan = reviewUseCase.plan(identifier, sprint, planInput);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
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
