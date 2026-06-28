import { executeCommand, type ExecuteResult } from "../shared/io/command.ts";
import { logger } from "../shared/io/logger.ts";
import type { ExecutionResult, Plan, Step, StepResult } from "../domain/types.ts";
import type { PlanGateway } from "../domain/plan-gateway.ts";

export type CommandRunner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

function parseJsonOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export class PlanGatewayAdapter implements PlanGateway {
  constructor(
    private readonly owner: string,
    private readonly repository: string,
    private readonly runCommand: CommandRunner = (cmd, args) => executeCommand({ cmd, args }),
  ) {}

  async execute(plan: Plan): Promise<ExecutionResult> {
    if (plan.steps.length === 0) {
      return { stepResults: [] };
    }

    const stepResults: StepResult[] = [];
    let lastItemId: string | undefined;

    for (const step of plan.steps) {
      const result = await this.executeStep(step, lastItemId);
      stepResults.push(result);
      if (result.success && result.itemId) {
        lastItemId = result.itemId;
      }
    }

    return { stepResults };
  }

  private async executeStep(
    step: Step,
    lastItemId?: string,
  ): Promise<StepResult> {
    try {
      switch (step.operation) {
        case "createItem":
          return await this.handleCreateItem(step.params);
        case "addComment":
          return await this.handleAddComment(step.params, lastItemId);
        case "findItem":
          return await this.handleFindItem(step.params);
        case "updateItem":
          return await this.handleUpdateItem(step.params);
        case "searchItems":
          return await this.handleSearchItems(step.params);
        default:
          return {
            operation: step.operation,
            success: false,
            error: `Unknown operation: ${step.operation}`,
          };
      }
    } catch (e) {
      return {
        operation: step.operation,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private buildRepoArg(): string[] {
    return ["--repo", `${this.owner}/${this.repository}`];
  }

  /**
   * createItem 操作を処理する。GitHub Issue を作成し、作成結果の itemId と nodeId を返す。
   * @param params.title - Issue のタイトル
   * @param params.body - Issue の本文
   * @param params.type - Issue に付与するラベル種別（デフォルト: PBI）
   * @returns 作成された Issue の itemId, nodeId, url を含む StepResult
   */
  private async handleCreateItem(params: Record<string, unknown>): Promise<StepResult> {
    const title = String(params.title ?? "");
    const body = String(params.body ?? "");
    const type = String(params.type ?? "PBI");
    const args = [
      "issue",
      "create",
      "--title",
      title,
      "--body",
      body,
      "--label",
      `type:${type}`,
      ...this.buildRepoArg(),
    ];
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "createItem", success: false, error: result.stderr };
    }
    const url = result.stdout.trim();
    const match = url.match(/\/issues\/(\d+)$/);
    const itemId = match ? match[1] : undefined;

    let nodeId: string | undefined;
    if (itemId) {
      try {
        const viewResult = await this.runCommand(
          "gh",
          ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
        );
        if (viewResult.code === 0) {
          nodeId = JSON.parse(viewResult.stdout).id;
        }
      } catch {
        logger.warn(`Failed to fetch nodeId for issue #${itemId}, continuing without it`);
      }
    }

    return { operation: "createItem", success: true, itemId, nodeId, output: { url } };
  }

  /**
   * addComment 操作を処理する。GitHub Issue にコメントを追加する。
   * @param params.itemId - コメント先の Issue 番号（省略時は直前の createItem 結果を使用）
   * @param params.body - コメント本文
   * @param lastItemId - 前 Step で作成された itemId（連鎖用）
   * @returns コメント追加結果の StepResult
   */
  private async handleAddComment(
    params: Record<string, unknown>,
    lastItemId?: string,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? lastItemId ?? "");
    if (!itemId) {
      return {
        operation: "addComment",
        success: false,
        error: "No target issue specified and no previous createItem context available",
      };
    }
    const body = String(params.body ?? "");
    const args = [
      "issue",
      "comment",
      itemId,
      "--body",
      body,
      ...this.buildRepoArg(),
    ];
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "addComment", success: false, error: result.stderr };
    }
    return { operation: "addComment", success: true, itemId };
  }

  /**
   * findItem 操作を処理する。指定された Issue 番号の詳細情報を取得する。
   * @param params.itemId - 取得対象の Issue 番号
   * @returns Issue の詳細情報（number, title, body, labels, comments）を含む StepResult
   */
  private async handleFindItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "findItem", success: false, error: "itemId is required" };
    }
    const args = [
      "issue",
      "view",
      itemId,
      "--json",
      "number,title,body,labels,comments",
      ...this.buildRepoArg(),
    ];
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "findItem", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "findItem", success: false, error: result.stderr };
    }

    const output = parseJsonOutput(result.stdout) as Record<string, unknown> | undefined;
    if (!output) {
      return { operation: "findItem", success: false, error: "Failed to parse gh output" };
    }

    return {
      operation: "findItem",
      success: true,
      itemId,
      nodeId: output.id as string | undefined,
      output,
    };
  }

  /**
   * searchItems 操作を処理する。指定されたラベル種別で Issue を検索する。
   * @param params.type - 検索するラベル種別（例: "Vision"）
   * @returns 検索結果（number, title, labels の配列）を含む StepResult
   */
  private async handleSearchItems(params: Record<string, unknown>): Promise<StepResult> {
    const type = String(params.type ?? "");
    if (!type) {
      return { operation: "searchItems", success: false, error: "type is required" };
    }
    const args = [
      "issue",
      "list",
      "--label",
      `type:${type}`,
      "--json",
      "number,title,labels",
      "--state",
      "all",
      ...this.buildRepoArg(),
    ];
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "searchItems", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "searchItems", success: false, error: result.stderr };
    }

    const output = parseJsonOutput(result.stdout);
    if (output === undefined) {
      return { operation: "searchItems", success: false, error: "Failed to parse gh output" };
    }

    return { operation: "searchItems", success: true, output };
  }

  /**
   * updateItem 操作を処理する。GitHub Issue のタイトル更新および本文追記を行う。
   * @param params.itemId - 更新対象の Issue 番号
   * @param params.title - 新しいタイトル（省略時は変更なし）
   * @param params.bodyAppend - 既存本文に追記する内容（省略時は追記なし）
   * @returns 更新結果の StepResult
   */
  private async handleUpdateItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "updateItem", success: false, error: "itemId is required" };
    }
    const title = params.title ? String(params.title) : undefined;
    const bodyAppend = params.bodyAppend ? String(params.bodyAppend) : undefined;

    if (bodyAppend) {
      return await this.updateItemWithBodyAppend(itemId, title, bodyAppend);
    }

    const args = ["issue", "edit", itemId, ...this.buildRepoArg()];
    if (title) args.push("--title", title);
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "updateItem", success: false, error: result.stderr };
    }
    return { operation: "updateItem", success: true, itemId };
  }

  private async updateItemWithBodyAppend(
    itemId: string,
    title: string | undefined,
    bodyAppend: string,
  ): Promise<StepResult> {
    let viewResult;
    try {
      viewResult = await this.runCommand(
        "gh",
        ["issue", "view", itemId, "--json", "body", ...this.buildRepoArg()],
      );
    } catch (e) {
      return { operation: "updateItem", success: false, error: String(e) };
    }
    if (viewResult.code !== 0) {
      return { operation: "updateItem", success: false, error: viewResult.stderr };
    }
    const parsed = parseJsonOutput(viewResult.stdout) as { body?: string } | undefined;
    if (!parsed) {
      return { operation: "updateItem", success: false, error: "Failed to parse gh output" };
    }
    const currentBody = parsed.body ?? "";
    const newBody = currentBody + "\n" + bodyAppend;
    const args = ["issue", "edit", itemId, "--body", newBody, ...this.buildRepoArg()];
    if (title) args.push("--title", title);
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "updateItem", success: false, error: result.stderr };
    }
    return { operation: "updateItem", success: true, itemId };
  }
}
