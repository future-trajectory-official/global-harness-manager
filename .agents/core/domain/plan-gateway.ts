import type { ExecutionResult, Plan } from "./types.ts";

/**
 * Planの実行を担当するGatewayのポート（インターフェース）。
 *
 * Domain層はPlanを生成し、PlanGatewayを介して実行する。
 * Gateway層（具象実装）はPlan内の各Stepを解釈し、適切な外部サービス操作
 * （Issue作成、Projects V2更新、ファイルI/O等）へルーティングする。
 *
 * ## 依存方向（DIP）
 *
 * - Domain層が本インターフェース（ポート）を定義する
 * - Gateway層が本インターフェースを実装する（アダプター）
 * - Domain層はGateway層の具象実装を知らない
 */
export interface PlanGateway {
  /**
   * Planに含まれる全Stepを逐次実行する。
   *
   * @param plan - 実行対象のPlan。steps が空でないこと。
   * @returns 全Stepの実行結果。StepResult の配列は Plan.steps と同数となる。
   * @throws {Error} INVALID_INPUT - plan.steps が空の場合。
   * @throws {Error} GATEWAY_ERROR - 外部サービスとの通信に失敗した場合。
   */
  execute(plan: Plan): ExecutionResult;
}
