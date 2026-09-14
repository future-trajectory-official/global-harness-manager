#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { EffortRecord } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface EstimateWpInitialEffortInput {
  identifier: { title: string; id: string; code?: string };
  initialEstimate: number;
}

function validateInput(input: EstimateWpInitialEffortInput): void {
  if (!input.identifier) {
    throw new Error("INVALID_INPUT: identifier is required");
  }
  if (!input.identifier.id) {
    throw new Error("INVALID_INPUT: identifier.id must not be empty");
  }
  if (typeof input.initialEstimate !== "number" || input.initialEstimate < 0) {
    throw new Error("INVALID_INPUT: initialEstimate must be a non-negative number");
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<EstimateWpInitialEffortInput>();
    validateInput(input);
    const effort: EffortRecord = { initialEstimate: input.initialEstimate };
    const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
    const plan = workPackageUseCase.estimateInitialEffort(identifier, effort);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
    } else {
      const result = await workPackageUseCase.executePlan(plan);
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
