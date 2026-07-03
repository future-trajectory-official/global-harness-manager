#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify } from "../../../../../core/domain/types.ts";
import type {
  EntityScope,
  GoalStatement,
  ProductGoalIdentifier,
} from "../../../../../core/domain/types.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { PlanGatewayAdapter } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { ConfigGatewayAdapter } from "../../../../../core/gateway/config-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface SetProductGoalInput {
  scope?: EntityScope;
  description: string;
}

/**
 * 入力JSONのバリデーション。
 * description は必須項目。
 */
export function validateInput(input: SetProductGoalInput): void {
  if (!input.description) {
    throw new Error("INVALID_INPUT: description is required");
  }
}

async function resolveScope(): Promise<EntityScope> {
  const config = new ConfigGatewayAdapter("", "");
  return await config.resolveScope();
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<SetProductGoalInput>();
    validateInput(input);

    const scope = input.scope ?? await resolveScope();
    const goalTitle = `Product Goal of ${scope.repository}`;
    const identifier: ProductGoalIdentifier = identify(scope, goalTitle);
    const statement: GoalStatement = { description: input.description };

    const plan = productGoalUseCase.set(identifier, statement);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
      return;
    }

    const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
    const result = await gateway.execute(plan);
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
