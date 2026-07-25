#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { pbiId } from "../../../../../core/domain/types.ts";
import type { ProductBacklogItemIdentifier } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface UpdatePbiInput {
  identifier: { title: string; id: string; code?: string };
  summary: string;
  artifacts?: string[];
  proofMethod?: string;
  reason: { description: string };
}

function validateInput(input: UpdatePbiInput): void {
  if (!input.identifier) {
    throw new Error("INVALID_INPUT: identifier is required");
  }
  if (!input.identifier.id) {
    throw new Error("INVALID_INPUT: identifier.id must not be empty");
  }
  if (!input.summary) {
    throw new Error("INVALID_INPUT: summary is required");
  }
  if (!input.reason?.description) {
    throw new Error("INVALID_INPUT: reason.description is required");
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<UpdatePbiInput>();
    validateInput(input);

    const identifier: ProductBacklogItemIdentifier = pbiId(
      input.identifier.title,
      input.identifier.id,
      input.identifier.code,
    );

    const plan = productBacklogItemUseCase.revise(
      identifier,
      {
        summary: input.summary,
        artifacts: input.artifacts
          ? { categories: input.artifacts.map((a) => ({ name: a, items: [] })) }
          : undefined,
        proofMethod: input.proofMethod,
      },
      { description: input.reason.description },
    );

    if (args["dry-run"]) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      const result = await productBacklogItemUseCase.executePlan(plan);
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
