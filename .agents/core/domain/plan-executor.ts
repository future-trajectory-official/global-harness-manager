import type { ExecutionResult, Plan, StepResult } from "./types.ts";
import type { PlanGateway } from "./plan-gateway.ts";

/**
 * Plan を Gateway 経由で実行する。
 *
 * Domain層が PlanGateway インターフェース（ポート）に依存することで、
 * Skill層は Gateway 層の具象実装を直接呼び出さずに Plan を実行できる。
 *
 * 制御の流れ: Skill層 → Domain層 (本関数) → Gateway層 (PlanGateway実装)
 *
 * @param plan - 実行対象の Plan
 * @param gateway - PlanGateway インターフェースの実装
 * @returns 全 Step の実行結果
 */
export async function executePlan(
  plan: Plan,
  gateway: PlanGateway,
): Promise<
  ExecutionResult & { getStep(entity: string, operation: string): StepResult | undefined }
> {
  return await gateway.execute(plan);
}
