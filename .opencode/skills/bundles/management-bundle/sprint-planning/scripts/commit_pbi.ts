#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { pbiId, sprintRef } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface CommitPbiInput {
  identifier: { title: string; id: string; code?: string };
  sprintNumber: number;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<CommitPbiInput>();
    if (!input.identifier?.id) {
      throw new Error("INVALID_INPUT: identifier.id is required");
    }
    if (!input.sprintNumber) {
      throw new Error("INVALID_INPUT: sprintNumber is required");
    }
    const identifier = pbiId(input.identifier.title, input.identifier.id, input.identifier.code);
    const sprint = sprintRef(input.sprintNumber);
    const plan = productBacklogItemUseCase.commit(identifier, sprint);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
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
