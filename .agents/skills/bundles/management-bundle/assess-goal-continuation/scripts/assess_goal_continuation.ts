#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify } from "../../../../../core/domain/types.ts";
import type {
  ChangeReason,
  EntityScope,
  GoalStatement,
  ProductGoalIdentifier,
} from "../../../../../core/domain/types.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { PlanGatewayAdapter } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { ConfigGatewayAdapter } from "../../../../../core/gateway/config-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface PivotInput {
  description: string;
  reason: string;
  code: string;
}

interface AssessGoalContinuationInput {
  scope?: EntityScope;
  title?: string;
  pivot?: PivotInput;
}

/**
 * 入力JSONのバリデーション。
 * title は任意（省略時はデフォルト値を使用）。pivot 指定時は description, reason, code も必須。
 */
export function validateInput(input: AssessGoalContinuationInput): void {
  if (input.pivot) {
    if (!input.pivot.description) {
      throw new Error("INVALID_INPUT: pivot.description is required");
    }
    if (!input.pivot.reason) {
      throw new Error("INVALID_INPUT: pivot.reason is required");
    }
    if (!input.pivot.code) {
      throw new Error("INVALID_INPUT: pivot.code is required");
    }
  }
}

async function resolveScope(): Promise<EntityScope> {
  const config = new ConfigGatewayAdapter("", "");
  return await config.resolveScope();
}

/**
 * 確認フェーズ: 現在のProductGoalを検索・取得する。
 * 戻り値の code は後続の更新フェーズで使用される。
 */
async function findProductGoal(
  gateway: PlanGatewayAdapter,
  scope: EntityScope,
  title: string,
): Promise<{ code: string; details: Record<string, unknown> }> {
  const searchPlan = {
    summary: "Search product goal",
    steps: [{
      entity: "ProductGoal" as const,
      operation: "search" as const,
      params: { labelType: "ProductGoal" },
    }],
  };
  const searchResult = await gateway.execute(searchPlan);
  const searchOutput = searchResult.stepResults[0]?.output as
    | Array<{ number: number }>
    | undefined;
  const goalNumber = searchOutput?.[0]?.number;
  if (!goalNumber) {
    console.error("No ProductGoal issue found. Use set-product-goal to create one first.");
    Deno.exit(1);
  }

  const tempIdentifier: ProductGoalIdentifier = identify(
    scope,
    title,
    "pending",
    String(goalNumber),
  );
  const viewPlan = productGoalUseCase.find(tempIdentifier);
  const viewResult = await gateway.execute(viewPlan);
  const viewOutput = viewResult.stepResults[0]?.output as
    | Record<string, unknown>
    | undefined;
  if (!viewOutput) {
    console.error("Failed to fetch ProductGoal issue details");
    Deno.exit(1);
  }

  return { code: String(goalNumber), details: viewOutput };
}

/**
 * 更新フェーズ: ProductGoalをピボットする。
 * code から node-id を解決してから pivot を実行する。
 */
async function pivotProductGoal(
  gateway: PlanGatewayAdapter,
  scope: EntityScope,
  title: string,
  pivot: PivotInput,
): Promise<unknown> {
  const tempIdentifier: ProductGoalIdentifier = identify(
    scope,
    title,
    "pending",
    pivot.code,
  );
  const viewPlan = productGoalUseCase.find(tempIdentifier);
  const viewResult = await gateway.execute(viewPlan);
  const viewOutput = viewResult.stepResults[0]?.output as
    | { id?: string; number?: number }
    | undefined;
  const nodeId = viewOutput?.id ?? pivot.code;

  const resolvedIdentifier: ProductGoalIdentifier = identify(
    scope,
    title,
    nodeId,
    pivot.code,
  );
  const statement: GoalStatement = { description: pivot.description };
  const reason: ChangeReason = { description: pivot.reason };

  const pivotPlan = productGoalUseCase.pivot(resolvedIdentifier, statement, reason);
  return await gateway.execute(pivotPlan);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<AssessGoalContinuationInput>();
    validateInput(input);

    const scope = input.scope ?? await resolveScope();
    const goalTitle = input.title ?? `Product Goal of ${scope.repository}`;

    if (!input.pivot) {
      // 確認フェーズ
      if (args["dry-run"]) {
        const combinedPlan = {
          summary: `Assess goal continuation: ${goalTitle}`,
          steps: [
            { entity: "ProductGoal", operation: "search", params: { labelType: "ProductGoal" } },
            { entity: "ProductGoal", operation: "view", params: { itemId: "<issue-number>" } },
          ],
        };
        console.log(JSON.stringify(combinedPlan, null, 2));
        return;
      }

      const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
      const result = await findProductGoal(gateway, scope, goalTitle);
      console.log(JSON.stringify(result, null, 2));
    } else {
      // 更新フェーズ
      if (args["dry-run"]) {
        const identifier: ProductGoalIdentifier = identify(
          scope,
          goalTitle,
          "pending",
          input.pivot.code,
        );
        const statement: GoalStatement = { description: input.pivot.description };
        const reason: ChangeReason = { description: input.pivot.reason };
        const plan = productGoalUseCase.pivot(identifier, statement, reason);
        console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
        return;
      }

      const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
      const result = await pivotProductGoal(gateway, scope, goalTitle, input.pivot);
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
