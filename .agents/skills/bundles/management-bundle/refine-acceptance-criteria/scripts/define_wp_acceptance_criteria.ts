#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { pbiId } from "../../../../../core/domain/types.ts";
import type { WorkPackageData } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface DefineWpAcceptanceCriteriaInput {
  pbiIdentifier: { title: string; id: string; code?: string };
  wps: Array<{
    title: string;
    acItems: Array<{ number: string; description: string }>;
  }>;
}

function buildWorkPackages(wps: DefineWpAcceptanceCriteriaInput["wps"]): WorkPackageData[] {
  return wps.map((wp) => ({
    identifier: {
      scope: { owner: "unknown", repository: "unknown" },
      title: { value: wp.title },
      describe: () => ({ summary: wp.title, steps: [] }),
    },
    statement: {
      acceptanceCriteria: {
        items: wp.acItems.map((ac) => ({
          number: ac.number,
          description: ac.description,
          judgment: "unchecked" as const,
        })),
      },
    },
    parentPbi: {
      scope: { owner: "unknown", repository: "unknown" },
      title: { value: "" },
      describe: () => ({ summary: "", steps: [] }),
    },
    stage: "idea",
    state: "open",
  }));
}

function validateInput(input: DefineWpAcceptanceCriteriaInput): void {
  if (!input.pbiIdentifier) {
    throw new Error("INVALID_INPUT: pbiIdentifier is required");
  }
  if (!input.pbiIdentifier.id) {
    throw new Error("INVALID_INPUT: pbiIdentifier.id must not be empty");
  }
  if (!input.wps || input.wps.length === 0) {
    throw new Error("INVALID_INPUT: at least one wp is required");
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<DefineWpAcceptanceCriteriaInput>();
    validateInput(input);
    const identifier = pbiId(
      input.pbiIdentifier.title,
      input.pbiIdentifier.id,
      input.pbiIdentifier.code,
    );
    const workPackages = buildWorkPackages(input.wps);
    const plan = productBacklogItemUseCase.defineAcceptanceCriteria(identifier, workPackages);

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
