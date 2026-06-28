import type { ExecutionResult, Plan } from "./types.ts";

/**
 * Planの実行を担当するGatewayのポート（インターフェース）。
 *
 * Domain層はPlanを生成し、PlanGatewayを介して実行する。
 * Gateway層（具象実装）はPlan内の各Stepを解釈し、適切な外部サービス操作
 * （Issue作成、Projects V2更新、ファイルI/O等）へルーティングする。
 *
 * ## Step 連鎖（createItem → addComment）
 *
 * Vision / ProductGoal の設計仕様（design-spec.md 5.2）では、
 * 本文は Issue Comment に格納し、Body には変更履歴のみを記録する。
 * このため createItem で Issue を作成した直後に addComment で本文を追記する
 * Step 連鎖が必要となる。
 *
 * Gateway 層の具象実装は、以下のルールで Step 間コンテキストを解決する：
 *
 * 1. 各 Step 実行後、結果（itemId 等）を内部 ExecutionContext に保持する
 * 2. addComment / editComment の params.itemId が未指定の場合、
 *    直近の createItem Step で生成された itemId を暗黙的に使用する
 * 3. 明示的な params.itemId が指定された場合はそれを優先する
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
  execute(plan: Plan): Promise<ExecutionResult>;
}
