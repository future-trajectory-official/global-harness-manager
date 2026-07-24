#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { featureId, pbiId } from "../../../../../core/domain/types.ts";
import type {
  Artifacts,
  FeatureIdentifier,
  ProductBacklogItemStatement,
} from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface ProposePbiInput {
  title: string;
  summary: string;
  artifacts?: Artifacts;
  proofMethod?: string;
  parentFeature?: {
    title: string;
    id: string;
    code?: string;
  };
}

function buildStatement(input: ProposePbiInput): ProductBacklogItemStatement {
  return {
    summary: input.summary,
    artifacts: input.artifacts,
    proofMethod: input.proofMethod,
  };
}

function buildParentFeature(
  input: ProposePbiInput["parentFeature"],
): FeatureIdentifier | undefined {
  if (!input) return undefined;
  return featureId(input.title, input.id, input.code);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<ProposePbiInput>();
    const identifier = pbiId(input.title);
    const statement = buildStatement(input);
    const parentFeature = buildParentFeature(input.parentFeature);
    const plan = productBacklogItemUseCase.propose(identifier, statement, parentFeature);

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
