#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { identify, sprintId, UNKNOWN_SCOPE } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface PlanRetrospectiveInput {
  sprintNumber: number;
  scope?: EntityScope;
}

/** 入力JSONを検証する。sprintNumber は正の整数であること。 */
function validateInput(input: PlanRetrospectiveInput): void {
  if (!input) throw new Error("INVALID_INPUT: input is required");
  if (!Number.isInteger(input.sprintNumber) || input.sprintNumber < 1) {
    throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
  }
}

export { validateInput };

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<PlanRetrospectiveInput>();
    validateInput(input);

    const scope = input.scope ?? UNKNOWN_SCOPE;
    const sprint = sprintId(scope, input.sprintNumber);
    const title = `Sprint ${input.sprintNumber} Retrospective`;
    const identifier = identify(scope, title);
    const plan = retrospectiveUseCase.plan(identifier, sprint);

    if (args["dry-run"]) {
      console.log(
        JSON.stringify(
          {
            summary: plan.summary,
            resolvedSprint: { sprintNumber: input.sprintNumber },
            steps: plan.steps,
          },
          null,
          2,
        ),
      );
      return;
    }

    const result = await retrospectiveUseCase.executePlan(plan);
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
