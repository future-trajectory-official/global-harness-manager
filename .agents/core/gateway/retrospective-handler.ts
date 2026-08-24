import type { EntityType, StepOperation } from "../domain/types.ts";
import type { KeepProblemTryAdvice, SprintMetrics } from "../domain/types.ts";
import type { OperationHandler, PlanGatewayAdapter } from "./plan-gateway-adapter.ts";

/**
 * Retrospective エンティティの全操作ハンドラーを登録する専用ハンドラー。
 *
 * plan / recordSprintKpt / recordSprintMetrics / archive / view / search の各操作を
 * PlanGatewayAdapter の stepHandlers に登録する。recordSprintKpt と recordSprintMetrics は
 * 個別操作として分離されており、それぞれ KPT とメトリクスの構造化フィールド書込を担当する。
 */
export class RetrospectiveHandler {
  constructor(private readonly adapter: PlanGatewayAdapter) {}

  /** 操作ハンドラーの Map を stepHandlers にマージして登録する。 */
  register(stepHandlers: Map<EntityType, Map<StepOperation, OperationHandler>>): void {
    const handlers = new Map<StepOperation, OperationHandler>();

    /** plan 操作: type:Retrospective ラベルで Issue を作成し、Retrospective Board へ追加する。 */
    handlers.set("plan", async (_op, params) => {
      const result = await this.adapter.handleCreateItem({ ...params, type: "Retrospective" });
      if (!result.success || !result.itemId) return result;
      if (result.nodeId && this.adapter.retrospectiveBoardNumber) {
        try {
          await this.adapter.addItemToProject(
            result.nodeId,
            this.adapter.retrospectiveBoardNumber,
          );
        } catch { /* ok */ }
      }
      return result;
    });

    /** recordSprintKpt 操作: itemId 検証後、KPT の記録または変更理由コメントを処理する。 */
    handlers.set("recordSprintKpt", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "recordSprintKpt", success: false, error: "itemId is required" };
      }
      const kpta = params.kpta as KeepProblemTryAdvice | undefined;
      if (kpta) {
        const recordResult = await this.recordKptaFields(itemId, kpta);
        if (!recordResult.success || !params.body) {
          return recordResult;
        }
        const bodyResult = await this.adapter.handleUpdateItem({
          itemId,
          bodyAppend: params.body,
        });
        if (!bodyResult.success) {
          return { operation: "recordSprintKpt", success: false, itemId, error: bodyResult.error };
        }
        return recordResult;
      }
      return await this.adapter.handleAddComment({ itemId, body: params.body }, itemId);
    });

    /** recordSprintMetrics 操作: itemId 検証後、メトリクスの記録または変更理由コメントを処理する。 */
    handlers.set("recordSprintMetrics", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "recordSprintMetrics", success: false, error: "itemId is required" };
      }
      const metrics = params.metrics as SprintMetrics | undefined;
      if (metrics) {
        const recordResult = await this.recordMetricsFields(itemId, metrics);
        if (!recordResult.success || !params.body) {
          return recordResult;
        }
        const bodyResult = await this.adapter.handleUpdateItem({
          itemId,
          bodyAppend: params.body,
        });
        if (!bodyResult.success) {
          return {
            operation: "recordSprintMetrics",
            success: false,
            itemId,
            error: bodyResult.error,
          };
        }
        return recordResult;
      }
      return await this.adapter.handleAddComment({ itemId, body: params.body }, itemId);
    });

    /** archive 操作: 対象 Issue をクローズする。 */
    handlers.set("archive", async (_op, params) => {
      return await this.adapter.handleCloseItem(params);
    });

    /** view 操作: 対象 Issue の詳細を取得する。 */
    handlers.set("view", async (_op, params) => {
      return await this.adapter.handleFindItem(params);
    });

    /** search 操作: type:Retrospective ラベルで Issue を検索する。 */
    handlers.set("search", async (_op, params) => {
      return await this.adapter.handleSearchItems({ ...params, labelType: "Retrospective" });
    });

    const existing = stepHandlers.get("Retrospective") ?? new Map();
    for (const [op, handler] of handlers) existing.set(op, handler);
    stepHandlers.set("Retrospective", existing);
  }

  /**
   * KPT（Keep/Problem/Try/Advise）を Retrospective Board の個別フィールドに記録する。
   * @param itemId - 対象 Retrospective の Issue 番号
   * @param kpta - Keep/Problem/Try/Advise の各文章
   * @returns 記録結果の StepResult
   */
  private async recordKptaFields(
    itemId: string,
    kpta: KeepProblemTryAdvice,
  ): Promise<{ operation: string; success: boolean; itemId: string; error?: string }> {
    const fields: Array<[string, string]> = [];
    if (kpta.keep) fields.push(["harness-kpt-keep", kpta.keep]);
    if (kpta.problem) fields.push(["harness-kpt-problem", kpta.problem]);
    if (kpta.try) fields.push(["harness-kpt-try", kpta.try]);
    if (kpta.advise) fields.push(["harness-kpt-advise", kpta.advise]);
    const result = await this.writeFields(itemId, fields);
    return { operation: "recordSprintKpt", ...result };
  }

  /**
   * スプリントメトリクス（5指標）を Retrospective Board の構造化フィールドに記録する。
   * summary は snake_case ネスト構造（goal_achievement_rate 等）に変換して
   * harness-metrics-summary へ書き込み、5指標ナラティブは独立フィールドへ書き込む。
   * @param itemId - 対象 Retrospective の Issue 番号
   * @param metrics - スプリントメトリクス（summary ＋ 5指標ナラティブ）
   * @returns 記録結果の StepResult
   */
  private async recordMetricsFields(
    itemId: string,
    metrics: SprintMetrics,
  ): Promise<{ operation: string; success: boolean; itemId: string; error?: string }> {
    const fields: Array<[string, string]> = [];
    const s = metrics.summary;
    const summaryJson = JSON.stringify({
      goal_achievement_rate: { score: s.goalAchievementScore },
      estimation_accuracy: { score: s.estimationAccuracyScore },
      quality_integrity: { score: s.qualityIntegrityScore },
      collaboration_discipline: { score: s.collaborationDisciplineScore },
      velocity: { value: s.velocity },
    });
    fields.push(["harness-metrics-summary", summaryJson]);
    if (metrics.goalAchievement) {
      fields.push(["harness-metrics-goal-achievement", metrics.goalAchievement]);
    }
    if (metrics.estimationAccuracy) {
      fields.push(["harness-metrics-estimation-accuracy", metrics.estimationAccuracy]);
    }
    if (metrics.qualityIntegrity) {
      fields.push(["harness-metrics-quality-integrity", metrics.qualityIntegrity]);
    }
    if (metrics.collaborationDiscipline) {
      fields.push(["harness-metrics-collaboration-discipline", metrics.collaborationDiscipline]);
    }
    if (metrics.velocity) fields.push(["harness-metrics-velocity", metrics.velocity]);
    const result = await this.writeFields(itemId, fields);
    return { operation: "recordSprintMetrics", ...result };
  }

  /**
   * 指定フィールド群を Retrospective Board の Project V2 アイテムへ書き込む。
   * Issue の node-id を解決し、Retrospective Board に追加してから各フィールドを設定する。
   * ボード番号が未設定の場合は何もせず成功を返す。
   * @param itemId - 対象 Issue 番号
   * @param fields - [フィールド名, 値] の配列
   * @returns 成功時は { success: true, itemId }、失敗時は { success: false, error }
   */
  private async writeFields(
    itemId: string,
    fields: Array<[string, string]>,
  ): Promise<{ success: boolean; itemId: string; error?: string }> {
    if (fields.length === 0 || !this.adapter.retrospectiveBoardNumber) {
      return { success: true, itemId };
    }
    const nodeResult = await this.adapter.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "id",
      ...this.adapter.buildRepoArg(),
    ]);
    if (nodeResult.code !== 0) {
      return { success: false, itemId, error: nodeResult.stderr };
    }
    let nodeData: { id: string };
    try {
      nodeData = JSON.parse(nodeResult.stdout) as { id: string };
    } catch {
      return { success: false, itemId, error: "Failed to parse issue view output" };
    }
    let projectItemNodeId: string;
    try {
      ({ projectItemNodeId } = await this.adapter.addItemToProject(
        nodeData.id,
        this.adapter.retrospectiveBoardNumber,
      ));
    } catch {
      const owned = this.adapter.scopeOwner;
      const repod = this.adapter.scopeRepository;
      if (!owned || !repod) {
        return { success: false, itemId, error: "scope owner/repository is not resolved" };
      }
      const lookup =
        `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
      const lr = await this.adapter.runCommand("gh", [
        "api",
        "graphql",
        "-f",
        `query=${lookup}`,
        "-f",
        `owner=${owned}`,
        "-f",
        `repo=${repod}`,
        "-F",
        `num=${parseInt(itemId, 10)}`,
      ]);
      if (lr.code !== 0) {
        return { success: false, itemId, error: lr.stderr };
      }
      const ld = JSON.parse(lr.stdout) as {
        data?: {
          repository?: {
            issue?: {
              projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
            };
          };
        };
      };
      const matched = ld?.data?.repository?.issue?.projectItems?.nodes?.find((n) =>
        n.project.number === this.adapter.retrospectiveBoardNumber!
      );
      if (!matched) {
        return {
          success: false,
          itemId,
          error:
            `Retrospective #${itemId} is not on Board #${this.adapter.retrospectiveBoardNumber}`,
        };
      }
      projectItemNodeId = matched.id;
    }
    const errors: string[] = [];
    for (const [fieldName, value] of fields) {
      const result = await this.adapter.setTextFieldValue(
        projectItemNodeId,
        this.adapter.retrospectiveBoardNumber,
        fieldName,
        value,
      );
      if (!result.success) {
        errors.push(`${fieldName}: ${result.error ?? "unknown error"}`);
      }
    }
    if (errors.length > 0) {
      return { success: false, itemId, error: errors.join("; ") };
    }
    return { success: true, itemId };
  }
}
