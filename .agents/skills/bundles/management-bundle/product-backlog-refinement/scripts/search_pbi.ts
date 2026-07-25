#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import type { ProductBacklogItemSearchCondition } from "../../../../../core/domain/types.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface SearchPbiInput {
  keyword?: string;
  sprintNumber?: number;
  status?: string;
  state?: string;
}

function buildSearchCondition(input: SearchPbiInput): ProductBacklogItemSearchCondition {
  const summaryParts: string[] = [];
  if (input.keyword) summaryParts.push(`keyword="${input.keyword}"`);
  if (input.sprintNumber !== undefined) summaryParts.push(`sprint=${input.sprintNumber}`);
  if (input.status) summaryParts.push(`status="${input.status}"`);
  if (input.state) summaryParts.push(`state="${input.state}"`);
  const summary = summaryParts.length > 0
    ? `Search PBI: ${summaryParts.join(", ")}`
    : "Search PBI: (all)";
  const params: Record<string, unknown> = {};
  if (input.keyword) params.keyword = input.keyword;
  if (input.sprintNumber !== undefined) params.sprintNumber = input.sprintNumber;
  if (input.status) params.status = input.status;
  if (input.state) params.state = input.state;
  return {
    keyword: input.keyword,
    sprintNumber: input.sprintNumber,
    status: input.status,
    state: input.state,
    describe: () => ({
      summary,
      steps: [{
        entity: "ProductBacklogItem",
        operation: "search",
        params,
      }],
    }),
  };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<SearchPbiInput>();
    const condition = buildSearchCondition(input);
    const plan = productBacklogItemUseCase.search(condition);

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
