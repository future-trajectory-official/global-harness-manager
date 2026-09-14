#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { pbiId, Size } from "../../../../../core/domain/types.ts";
import type { SizeVariance } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface EstimatePbiSizeInput {
  identifier: { title: string; id: string; code?: string };
  size: "XS" | "S" | "M" | "L" | "XL";
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<EstimatePbiSizeInput>();
    const sizeObj = Size.fromString(input.size);
    if (!sizeObj) {
      throw new Error(
        `INVALID_INPUT: Invalid size "${input.size}". Must be one of: XS, S, M, L, XL`,
      );
    }
    const variance: SizeVariance = { estimate: sizeObj };
    const identifier = pbiId(input.identifier.title, input.identifier.id, input.identifier.code);
    const plan = productBacklogItemUseCase.estimateSize(identifier, variance);

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
