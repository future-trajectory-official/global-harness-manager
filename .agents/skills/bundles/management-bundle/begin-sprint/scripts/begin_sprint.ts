#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { sprintId, UNKNOWN_SCOPE } from "../../../../../core/domain/types.ts";
import type { EntityScope, Plan } from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface BeginSprintInput {
  sprintNumber: number;
  goal?: string;
  milestoneNodeId?: string;
  milestoneNumber?: string;
  scope?: EntityScope;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<BeginSprintInput>();
    const scope = input.scope ?? UNKNOWN_SCOPE;

    const identifier = input.goal
      ? sprintId(scope, input.sprintNumber, input.milestoneNodeId, input.milestoneNumber)
      : sprintId(scope, input.sprintNumber);

    const result = input.goal
      ? await sprintUseCase.setGoal(identifier, { description: input.goal }, {
        dryRun: args["dry-run"],
        owner: scope.owner,
        repository: scope.repository,
      })
      : await sprintUseCase.start(identifier, {
        dryRun: args["dry-run"],
        owner: scope.owner,
        repository: scope.repository,
      });

    if (args["dry-run"]) {
      console.log(
        JSON.stringify(
          { summary: (result as Plan).summary, steps: (result as Plan).steps },
          null,
          2,
        ),
      );
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
