#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { UNKNOWN_SCOPE } from "../../../../../core/domain/types.ts";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";
import {
  dryRunTarget,
  resolveTarget,
  retrospectiveRef,
} from "../../../../../core/shared/retrospective-utils.ts";

interface ArchiveRetrospectiveInput {
  sprintNumber?: number;
  code?: string;
  title?: string;
  scope?: EntityScope;
}

function validateInput(input: ArchiveRetrospectiveInput): void {
  if (!input) throw new Error("INVALID_INPUT: input is required");
  if (input.code == null && input.sprintNumber == null) {
    throw new Error("INVALID_INPUT: code or sprintNumber is required");
  }
  if (input.code != null && String(input.code).trim() === "") {
    throw new Error("INVALID_INPUT: code must not be empty");
  }
  if (
    input.sprintNumber != null &&
    (!Number.isInteger(input.sprintNumber) || input.sprintNumber < 1)
  ) {
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
    const input = await readJsonFromStdin<ArchiveRetrospectiveInput>();
    validateInput(input);

    const scope = input.scope ?? UNKNOWN_SCOPE;

    if (args["dry-run"]) {
      const target = dryRunTarget(input);
      const plan = retrospectiveUseCase.archive(
        retrospectiveRef(scope, target ?? { code: "0", title: "Retrospective" }),
      );
      console.log(
        JSON.stringify(
          {
            summary: plan.summary,
            resolvedTarget: target ?? { note: "実行時に検索します" },
            steps: plan.steps,
          },
          null,
          2,
        ),
      );
      return;
    }

    const target = await resolveTarget(input);
    const plan = retrospectiveUseCase.archive(retrospectiveRef(scope, target));
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
