#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { UNKNOWN_SCOPE } from "../../../../../core/domain/types.ts";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";
import {
  assertByteLimit,
  dryRunTarget,
  resolveTarget,
  retrospectiveRef,
} from "../../../../../core/shared/retrospective-utils.ts";

interface RecordSprintKptInput {
  sprintNumber?: number;
  code?: string;
  title?: string;
  kpta?: { keep: string; problem: string; try: string; advise: string };
  reason?: { description: string };
  scope?: EntityScope;
}

function validateInput(input: RecordSprintKptInput): void {
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
  if (!input.kpta) throw new Error("INVALID_INPUT: kpta is required");
  const { keep, problem, try: try_, advise } = input.kpta;
  for (
    const [fieldName, value] of [
      ["kpta.keep", keep],
      ["kpta.problem", problem],
      ["kpta.try", try_],
      ["kpta.advise", advise],
    ] as Array<[string, string]>
  ) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`INVALID_INPUT: ${fieldName} must not be empty`);
    }
    assertByteLimit(value, fieldName);
  }
  if (
    !input.reason || typeof input.reason.description !== "string" ||
    input.reason.description.trim() === ""
  ) {
    throw new Error("INVALID_INPUT: reason.description must not be empty");
  }
}

export { validateInput };

/** validateInput 通過後に kpta / reason の存在を型として保証するアサーション。 */
type ValidKptInput = RecordSprintKptInput & {
  kpta: { keep: string; problem: string; try: string; advise: string };
  reason: { description: string };
};
function assertValidKpt(input: RecordSprintKptInput): asserts input is ValidKptInput {
  if (!input.kpta || !input.reason) {
    throw new Error("INVALID_INPUT: kpta and reason are required");
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<RecordSprintKptInput>();
    validateInput(input);
    assertValidKpt(input);

    const scope = input.scope ?? UNKNOWN_SCOPE;

    if (args["dry-run"]) {
      const target = dryRunTarget(input);
      const plan = retrospectiveUseCase.recordSprintKpt(
        retrospectiveRef(scope, target ?? { code: "0", title: "Retrospective" }),
        input.kpta,
        input.reason,
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
    const plan = retrospectiveUseCase.recordSprintKpt(
      retrospectiveRef(scope, target),
      input.kpta,
      input.reason,
    );
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
