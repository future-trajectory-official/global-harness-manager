#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { pbiId, wpId } from "../../../../../core/domain/types.ts";
import type {
  AcceptanceCriterias,
  ProductBacklogItemIdentifier,
  WorkPackageStatement,
} from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface DefineWpInput {
  wpTitle: string;
  parentPbi: { title: string; id: string; code?: string };
  acItems: Array<{ number: string; description: string }>;
}

function buildWpStatement(acItems: DefineWpInput["acItems"]): WorkPackageStatement {
  const acceptanceCriteria: AcceptanceCriterias = {
    items: acItems.map((ac) => ({
      number: ac.number,
      description: ac.description,
      judgment: "unchecked" as const,
    })),
  };
  return { acceptanceCriteria };
}

function validateInput(input: DefineWpInput): void {
  if (!input.wpTitle) {
    throw new Error("INVALID_INPUT: wpTitle must not be empty");
  }
  if (!input.parentPbi) {
    throw new Error("INVALID_INPUT: parentPbi is required");
  }
  if (!input.parentPbi.id) {
    throw new Error("INVALID_INPUT: parentPbi.id must not be empty");
  }
  if (!input.acItems || input.acItems.length === 0) {
    throw new Error("INVALID_INPUT: at least one acItem is required");
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<DefineWpInput>();
    validateInput(input);
    const identifier = wpId(input.wpTitle);
    const statement = buildWpStatement(input.acItems);
    const parentPbi: ProductBacklogItemIdentifier = pbiId(
      input.parentPbi.title,
      input.parentPbi.id,
      input.parentPbi.code,
    );
    const plan = workPackageUseCase.define(identifier, statement, parentPbi);

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
