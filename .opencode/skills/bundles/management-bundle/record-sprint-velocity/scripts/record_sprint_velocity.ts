#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import type { VelocityMetrics } from "../../../../../core/domain/sprint-usecase.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";
import { sprintRef } from "../../../../../core/domain/types.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { parseArgs } from "@std/cli/parse-args";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface RecordSprintVelocityInput {
  velocity: Omit<VelocityMetrics, "sprintNumber">;
}

function validateInput(input: RecordSprintVelocityInput): void {
  if (!input.velocity) throw new Error("INVALID_INPUT: velocity is required");
  const { pbiCount, totalWeight, matchRate, summary } = input.velocity;
  if (
    !Number.isInteger(pbiCount) || !Number.isInteger(totalWeight) ||
    pbiCount < 0 || totalWeight < 0
  ) {
    throw new Error("INVALID_INPUT: pbiCount and totalWeight must be non-negative integers");
  }
  if (
    typeof matchRate !== "number" ||
    !Number.isFinite(matchRate) ||
    matchRate < 0 ||
    matchRate > 1
  ) {
    throw new Error("INVALID_INPUT: matchRate must be a number between 0 and 1");
  }
  if (typeof summary !== "string" || summary.trim() === "") {
    throw new Error("INVALID_INPUT: velocity.summary must not be empty");
  }
}

export { validateInput };

async function resolveLatestSprint() {
  const findPlan = sprintUseCase.find();
  const findResult = await sprintUseCase.executePlan(findPlan);
  const viewOutput = findResult.getStep("Sprint", "view")?.output as
    | { number: number; title: string }
    | undefined;
  if (!viewOutput || viewOutput.number == null || !viewOutput.title) {
    throw new Error("No open milestone found. Cannot resolve latest sprint.");
  }
  const sprintMatch = viewOutput.title.match(/^Sprint\s+(\d+)$/);
  if (!sprintMatch) {
    throw new Error(`Unexpected milestone title format: "${viewOutput.title}"`);
  }
  return {
    milestoneNumber: String(viewOutput.number),
    sprintNumber: parseInt(sprintMatch[1], 10),
  };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<RecordSprintVelocityInput>();
    validateInput(input);

    const { milestoneNumber, sprintNumber } = await resolveLatestSprint();
    const identifier = sprintRef(sprintNumber, undefined, milestoneNumber);
    const velocity: VelocityMetrics = { ...input.velocity, sprintNumber };
    const plan = sprintUseCase.recordVelocity(identifier, velocity);

    if (args["dry-run"]) {
      console.log(
        JSON.stringify(
          {
            summary: plan.summary,
            resolvedSprint: { sprintNumber, milestoneNumber },
            steps: plan.steps,
          },
          null,
          2,
        ),
      );
      return;
    }

    const result = await sprintUseCase.executePlan(plan);
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
