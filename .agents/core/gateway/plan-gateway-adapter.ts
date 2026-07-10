import { executeCommand, type ExecuteResult } from "../shared/io/command.ts";
import { logger } from "../shared/io/logger.ts";
import type {
  EntityScope,
  EntityType,
  ExecutionResult,
  Plan,
  Step,
  StepOperation,
  StepResult,
} from "../domain/types.ts";
import type { PlanGateway } from "../domain/plan-gateway.ts";

export type CommandRunner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJsonOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

type OperationHandler = (
  operation: string,
  params: Record<string, unknown>,
  lastItemId?: string,
) => Promise<StepResult>;

export interface PlanResult extends ExecutionResult {
  getStep(entity: string, operation: string): StepResult | undefined;
}

export class PlanGatewayAdapter implements PlanGateway {
  private readonly stepHandlers = new Map<EntityType, Map<StepOperation, OperationHandler>>();
  private resolvedScope: EntityScope | null = null;

  constructor(
    private readonly runCommand: CommandRunner = (cmd, args) => executeCommand({ cmd, args }),
  ) {
    // === Vision 操作の登録 ===
    const visionCreate: OperationHandler = async (op, params) => {
      const existingItems = await this.handleSearchItems({ labelType: "Vision" });
      if (
        existingItems.success && Array.isArray(existingItems.output) &&
        existingItems.output.length > 0
      ) {
        const existing = existingItems.output[0] as { number: number };
        return {
          operation: op,
          success: false,
          error:
            `A Vision already exists (Issue #${existing.number}). Use pivot to update instead.`,
        };
      }
      return await this.handleCreateItem(params, "Vision");
    };
    const visionComment: OperationHandler = (_op, params, lastItemId) =>
      this.handleAddComment(params, lastItemId);
    const visionView: OperationHandler = (_op, params) => this.handleFindItem(params);
    const visionSearch: OperationHandler = (_op, params) => this.handleSearchItems(params);
    const visionUpdate: OperationHandler = (_op, params) => this.handleUpdateItem(params);

    for (const op of ["create"] as const) {
      this.register("Vision", op, visionCreate);
    }
    for (const op of ["comment"] as const) {
      this.register("Vision", op, visionComment);
    }
    this.register("Vision", "view", visionView);
    this.register("Vision", "search", visionSearch);
    for (const op of ["update"] as const) {
      this.register("Vision", op, visionUpdate);
    }

    // === Review 操作の登録 ===
    const reviewCreate: OperationHandler = (_op, params) => this.handleCreateItem(params, "Review");
    this.register("Review", "plan", reviewCreate);
    this.register("Review", "report", (_op, params) => this.handleReviewReport(params));
    this.register("Review", "archive", (_op, params) => this.handleCloseItem(params));
    this.register("Review", "view", (_op, params) => this.handleFindItem(params));
    this.register("Review", "search", (_op, params) => this.handleSearchItems(params));
    this.register("Review", "update", async (_op, params, lastItemId) => {
      if (params.title) {
        return await this.handleUpdateItem({ ...params, bodyAppend: params.body });
      }
      return await this.handleAddComment(params, lastItemId);
    });
    this.register("Review", "revise", (_op, params) => this.handleReviewRevise(params));

    // === ProductGoal 操作の登録 ===
    const productGoalCreate: OperationHandler = async (op, params) => {
      const existingItems = await this.handleSearchItems({ labelType: "ProductGoal" });
      if (
        existingItems.success && Array.isArray(existingItems.output) &&
        existingItems.output.length > 0
      ) {
        const existing = existingItems.output[0] as { number: number };
        return {
          operation: op,
          success: false,
          error:
            `A ProductGoal already exists (Issue #${existing.number}). Use pivot to update instead.`,
        };
      }
      return await this.handleCreateItem(params, "ProductGoal");
    };
    this.register("ProductGoal", "create", productGoalCreate);
    this.register(
      "ProductGoal",
      "comment",
      (_op, params, lastItemId) => this.handleAddComment(params, lastItemId),
    );
    this.register("ProductGoal", "view", (_op, params) => this.handleFindItem(params));
    this.register("ProductGoal", "update", (_op, params) => this.handleUpdateItem(params));
    this.register("ProductGoal", "search", (_op, params) => this.handleSearchItems(params));

    // === Epic 操作の登録 ===
    this.register("Epic", "create", (_op, params) => this.handleCreateItem(params, "Epic"));
    this.register(
      "Epic",
      "comment",
      (_op, params, lastItemId) => this.handleAddComment(params, lastItemId),
    );
    this.register("Epic", "view", (_op, params) => this.handleFindItem(params));
    this.register("Epic", "search", (_op, params) => this.handleSearchItems(params));
    this.register("Epic", "update", (_op, params) => this.handleUpdateItem(params));

    // === Feature 操作の登録 ===
    this.register("Feature", "create", async (_op, params) => {
      const result = await this.handleCreateItem(params, "Feature");
      if (result.success && params.parentEpic && result.itemId) {
        const parentResult = await this.#handleSetParent(result.itemId, String(params.parentEpic));
        if (!parentResult.success) {
          return parentResult;
        }
      }
      return result;
    });
    this.register(
      "Feature",
      "comment",
      (_op, params, lastItemId) => this.handleAddComment(params, lastItemId),
    );
    this.register("Feature", "view", (_op, params) => this.handleFindItem(params));
    this.register("Feature", "search", (_op, params) => this.handleSearchItems(params));
    this.register("Feature", "update", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "update", success: false, error: "itemId is required" };
      }
      if (params.parentEpic) {
        return await this.#handleSetParent(itemId, String(params.parentEpic));
      }
      if ("parentEpic" in params) {
        return await this.#handleRemoveParent(itemId);
      }
      if (params.title || params.bodyAppend) {
        return await this.handleUpdateItem(params);
      }
      return await this.handleUpdateItem(params);
    });

    // === Sprint (Milestone) 操作の登録 ===
    this.register("Sprint", "create", (op, params) => this.#handleSprintCreate(op, params));
    this.register("Sprint", "endSprint", (op, params) => this.#handleSprintEnd(op, params));
    this.register("Sprint", "setGoal", (op, params) => this.#handleSprintSetGoal(op, params));
    this.register("Sprint", "setDueDate", (op, params) => this.#handleSprintSetDueDate(op, params));
    this.register("Sprint", "search", (op, params) => this.#handleSprintSearch(op, params));
    this.register(
      "Sprint",
      "view",
      (op, params, lastItemId) => this.#handleSprintView(op, params, lastItemId),
    );
    this.register("Scope", "resolve", (_op, params) => this.handleScopeResolve(params));
  }

  /** テスト用にscopeを直接設定する。通常はScope.resolve Stepで設定される。 */
  setScope(owner: string, repository: string): void {
    this.resolvedScope = { owner, repository };
  }

  private async handleScopeResolve(params: Record<string, unknown>): Promise<StepResult> {
    const owner = String(params.owner ?? "");
    const repository = String(params.repository ?? "");

    if (owner && repository && owner !== "unknown" && repository !== "unknown") {
      this.resolvedScope = { owner, repository };
      return { operation: "resolve", success: true };
    }

    const remoteResult = await this.runCommand("git", ["remote", "get-url", "origin"]);
    if (remoteResult.code !== 0) {
      return {
        operation: "resolve",
        success: false,
        error: `Failed to resolve scope: ${remoteResult.stderr}`,
      };
    }

    const remoteUrl = remoteResult.stdout.trim();
    const remoteOwner = remoteUrl.match(/(?:github\.com[/:])([\w.-]+)\//)?.[1];
    const remoteRepo = remoteUrl.match(/(?:github\.com[/:][\w.-]+\/)([\w.-]+?)(?:\.git)?$/)?.[1];
    if (!remoteOwner || !remoteRepo) {
      return {
        operation: "resolve",
        success: false,
        error: `Could not parse owner/repo from git remote: ${remoteUrl}`,
      };
    }

    const authResult = await this.runCommand("gh", ["auth", "status"]);
    if (authResult.code !== 0) {
      return {
        operation: "resolve",
        success: false,
        error: `Not authenticated with gh. Run \`gh auth login\` first.`,
      };
    }

    const repoResult = await this.runCommand("gh", ["repo", "view", "--json", "owner,name"]);
    if (repoResult.code !== 0) {
      return {
        operation: "resolve",
        success: false,
        error:
          `Repository '${remoteOwner}/${remoteRepo}' not found or no access. Check your gh auth with \`gh auth status\` and switch account with \`gh auth switch\` if needed.`,
      };
    }

    try {
      const data = JSON.parse(repoResult.stdout);
      this.resolvedScope = { owner: data.owner.login, repository: data.name };
      return { operation: "resolve", success: true };
    } catch {
      return {
        operation: "resolve",
        success: false,
        error: `Failed to parse gh repo view output: ${repoResult.stdout}`,
      };
    }
  }

  private register(entity: EntityType, operation: StepOperation, handler: OperationHandler): void {
    let entityMap = this.stepHandlers.get(entity);
    if (!entityMap) {
      entityMap = new Map<StepOperation, OperationHandler>();
      this.stepHandlers.set(entity, entityMap);
    }
    entityMap.set(operation, handler);
  }

  async execute(plan: Plan): Promise<PlanResult> {
    if (plan.steps.length === 0) {
      return {
        stepResults: [],
        getStep: () => undefined,
      };
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

    const planSteps = plan.steps;

    return {
      stepResults,
      getStep(entity: string, operation: string): StepResult | undefined {
        const idx = planSteps.findIndex(
          (s) => s.entity === entity && s.operation === operation,
        );
        return idx >= 0 ? stepResults[idx] : undefined;
      },
    };
  }

  private async executeStep(
    step: Step,
    lastItemId?: string,
  ): Promise<StepResult> {
    const entry = step as {
      entity: EntityType;
      operation: StepOperation;
      params: Record<string, unknown>;
    };
    const entity = entry.entity;
    const operation = entry.operation;

    const entityMap = this.stepHandlers.get(entity);
    const handler = entityMap?.get(operation);

    if (!handler) {
      return {
        operation,
        success: false,
        error: `No handler registered for ${entity}:${operation}`,
      };
    }

    try {
      return await handler(operation, entry.params, lastItemId);
    } catch (e) {
      return {
        operation,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private async handleCloseItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "archive", success: false, error: "itemId is required" };
    }
    const args = [
      "issue",
      "close",
      itemId,
      ...this.buildRepoArg(),
    ];
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "archive", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "archive", success: false, error: result.stderr };
    }
    return { operation: "archive", success: true, itemId };
  }

  private buildRepoArg(): string[] {
    if (!this.resolvedScope) {
      return [];
    }
    return ["--repo", `${this.resolvedScope.owner}/${this.resolvedScope.repository}`];
  }

  /**
   * createItem 操作を処理する。GitHub Issue を作成し、作成結果の itemId と nodeId を返す。
   * @param params.title - Issue のタイトル
   * @param params.body - Issue の本文
   * @param params.type - Issue に付与するラベル種別（デフォルト: PBI）
   * @returns 作成された Issue の itemId, nodeId, url を含む StepResult
   */
  private async handleCreateItem(
    params: Record<string, unknown>,
    entity?: string,
  ): Promise<StepResult> {
    const title = String(params.title ?? "");
    const body = String(params.body ?? "");
    const type = String(params.type ?? params.labelType ?? entity ?? "PBI");
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
    const sprint = params.sprint;
    if (sprint) {
      const milestone = typeof sprint === "string"
        ? sprint
        : (sprint as { title?: { value?: string } }).title?.value;
      if (milestone) {
        args.push("--milestone", milestone);
      }
    }
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "create", success: false, error: result.stderr };
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

    return { operation: "create", success: true, itemId, nodeId, output: { url } };
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
        operation: "comment",
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
      return { operation: "comment", success: false, error: result.stderr };
    }
    return { operation: "comment", success: true, itemId };
  }

  /**
   * report 操作を処理する。GitHub Issue の本文内の AC マーカー（❔）を
   * 合格/不合格/条件付き合格 のマーカーに置き換え、Overall Result を追記する。
   */
  private async handleReviewReport(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "report", success: false, error: "itemId is required" };
    }

    const viewResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "body",
      ...this.buildRepoArg(),
    ]);
    if (viewResult.code !== 0) {
      return { operation: "report", success: false, error: viewResult.stderr };
    }
    const parsed = JSON.parse(viewResult.stdout) as { body?: string } | undefined;
    const currentBody = parsed?.body ?? "";

    const postPlanAcGroups = params.postPlanAcGroups as
      | Array<{ acJudgments: Array<{ number: string; judgment: string }> }>
      | undefined;

    let newBody = currentBody;
    if (postPlanAcGroups) {
      for (const group of postPlanAcGroups) {
        for (const ac of group.acJudgments) {
          const marker = ac.judgment === "pass" ? "✅" : ac.judgment === "fail" ? "❌" : "⚠️";
          const acPattern = new RegExp(`❔\\s*(AC_${ac.number}:)`);
          newBody = newBody.replace(acPattern, `${marker} $1`);
        }
      }
    }

    if (params.overallResult) {
      const or = params.overallResult as { judgment: string; reason?: string };
      const judgmentMap: Record<string, string> = {
        pass: "✅ 合格",
        conditional: "⚠️ 条件付き合格",
        fail: "❌ 不合格",
      };
      const judgmentText = judgmentMap[or.judgment] ?? or.judgment;
      newBody = newBody.replace(/(?<=### 判定結果\n\n).*/, judgmentText);
      if (or.reason) {
        newBody = newBody.replace(/(?<=### PO意見\n\n).*/, or.reason);
      }
    }

    const editResult = await this.runCommand("gh", [
      "issue",
      "edit",
      itemId,
      "--body",
      newBody,
      ...this.buildRepoArg(),
    ]);
    if (editResult.code !== 0) {
      return { operation: "report", success: false, error: editResult.stderr };
    }

    return { operation: "report", success: true, itemId };
  }

  /**
   * revise 操作を処理する。Issue 本文内の AC マーカーを論理削除（➖）に書き換え、
   * スプリント中追加検証計画に新規 AC を追記する。
   */
  private async handleReviewRevise(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "revise", success: false, error: "itemId is required" };
    }

    const viewResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "body",
      ...this.buildRepoArg(),
    ]);
    if (viewResult.code !== 0) {
      return { operation: "revise", success: false, error: viewResult.stderr };
    }
    const parsed = JSON.parse(viewResult.stdout) as { body?: string } | undefined;
    const currentBody = parsed?.body ?? "";

    let newBody = currentBody;
    const removed = params.removed as
      | { items?: Array<{ number: string; description: string }> }
      | undefined;
    const removedScoped = params.removedScoped as
      | Array<{ pbiNumber: number; wpNumber: string; number: string; description: string }>
      | undefined;
    const addedGroups = params.addedGroups as
      | Array<
        {
          pbiNumber: number;
          pbiTitle?: string;
          wpNumber: string;
          wpTitle?: string;
          acJudgments: Array<{ number: string; description?: string; judgment?: string }>;
        }
      >
      | undefined;

    if (removedScoped?.length) {
      for (const item of removedScoped) {
        const acNum = String(item.number);
        const pbiMarker = `### 📦 PBI: [${item.pbiNumber}]`;
        const wpMarker = `#### WP_${item.wpNumber}:`;
        const re = new RegExp(
          `(${escapeRegex(pbiMarker)}[\\s\\S]*?${escapeRegex(wpMarker)}[\\s\\S]*?)- [❔✅⚠️❌] AC_${
            escapeRegex(acNum)
          }:.*`,
        );
        newBody = newBody.replace(re, `$1- ➖ AC_${acNum}: ${item.description}`);
      }
    } else if (removed?.items) {
      for (const item of removed.items) {
        const acNum = String(item.number);
        const acPattern = new RegExp(`-\\s*[❔✅⚠️❌]\\s*AC_${escapeRegex(acNum)}:.*`);
        newBody = newBody.replace(acPattern, `- ➖ AC_${acNum}: ${item.description}`);
      }
    }

    if (addedGroups && addedGroups.length > 0) {
      const planSectionMatch = newBody.match(/^## スプリント中追加検証計画[\s\S]*?(?=\n## )/m) ??
        newBody.match(/^## スプリント中追加検証計画[\s\S]*$/m);
      const planLines: string[] = [];
      planLines.push("## スプリント中追加検証計画");
      planLines.push("");
      for (const group of addedGroups) {
        planLines.push(`### 📦 PBI: [${group.pbiNumber}] ${group.pbiTitle ?? ""}`);
        planLines.push("");
        planLines.push(`#### WP_${group.wpNumber}: ${group.wpTitle ?? ""}`);
        planLines.push("");
        for (const ac of group.acJudgments) {
          const desc = ac.description ?? "";
          planLines.push(`- ❔ AC_${ac.number}: ${desc}`);
        }
        planLines.push("");
      }
      const planSection = planLines.join("\n");
      if (planSectionMatch) {
        newBody = newBody.replace(planSectionMatch[0], planSection);
      } else {
        newBody = newBody + "\n" + planSection;
      }
    }

    const editResult = await this.runCommand("gh", [
      "issue",
      "edit",
      itemId,
      "--body",
      newBody,
      ...this.buildRepoArg(),
    ]);
    if (editResult.code !== 0) {
      return { operation: "revise", success: false, error: editResult.stderr };
    }

    return { operation: "revise", success: true, itemId };
  }

  /**
   * findItem 操作を処理する。指定された Issue 番号の詳細情報を取得する。
   * @param params.itemId - 取得対象の Issue 番号
   * @returns Issue の詳細情報（number, title, body, labels, comments）を含む StepResult
   */
  private async handleFindItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "view", success: false, error: "itemId is required" };
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
      return { operation: "view", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "view", success: false, error: result.stderr };
    }

    const output = parseJsonOutput(result.stdout) as Record<string, unknown> | undefined;
    if (!output) {
      return { operation: "view", success: false, error: "Failed to parse gh output" };
    }

    return {
      operation: "view",
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
    const type = String(params.type ?? params.labelType ?? "");
    if (!type) {
      return { operation: "search", success: false, error: "type is required" };
    }
    const args = [
      "issue",
      "list",
      "--label",
      `type:${type}`,
      "--json",
      "number,title,labels",
      "--state",
      "open",
      ...this.buildRepoArg(),
    ];
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "search", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "search", success: false, error: result.stderr };
    }

    const output = parseJsonOutput(result.stdout);
    if (output === undefined) {
      return { operation: "search", success: false, error: "Failed to parse gh output" };
    }

    return { operation: "search", success: true, output };
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
      return { operation: "update", success: false, error: "itemId is required" };
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
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
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
      return { operation: "update", success: false, error: String(e) };
    }
    if (viewResult.code !== 0) {
      return { operation: "update", success: false, error: viewResult.stderr };
    }
    const parsed = parseJsonOutput(viewResult.stdout) as { body?: string } | undefined;
    if (!parsed) {
      return { operation: "update", success: false, error: "Failed to parse gh output" };
    }
    const currentBody = parsed.body ?? "";
    const newBody = currentBody + "\n" + bodyAppend;
    const args = ["issue", "edit", itemId, "--body", newBody, ...this.buildRepoArg()];
    if (title) args.push("--title", title);
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }

  #milestoneUrl(itemId?: string): string {
    if (!this.resolvedScope) return "";
    const base = `repos/${this.resolvedScope.owner}/${this.resolvedScope.repository}/milestones`;
    return itemId ? `${base}/${itemId}` : base;
  }

  async #handleSprintCreate(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const title = String(params.title ?? "");
    const description = String(params.description ?? "");
    if (!title) {
      return { operation, success: false, error: "Milestone title is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "POST",
      this.#milestoneUrl(),
      "-f",
      `title=${title}`,
      "-f",
      `description=${description}`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    const output = parseJsonOutput(result.stdout) as { number?: number } | undefined;
    return {
      operation,
      success: true,
      itemId: String(output?.number ?? ""),
      output,
    };
  }

  async #handleSprintEnd(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      "state=closed",
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  async #handleSprintSetGoal(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const description = String(params.description ?? "");
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `description=${description}`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  async #handleSprintSetDueDate(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const dueDate = String(params.dueDate ?? "");
    if (!dueDate) {
      return { operation, success: false, error: "dueDate is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `due_on=${dueDate}`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  async #handleSprintSearch(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const state = String(params.state ?? "open");
    const result = await this.runCommand("gh", [
      "api",
      `repos/${this.resolvedScope?.owner ?? "unknown"}/${
        this.resolvedScope?.repository ?? "unknown"
      }/milestones?state=${state}&per_page=1&direction=desc`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    const milestones = parseJsonOutput(result.stdout) as Array<{ number: number }> | undefined;
    if (!milestones || milestones.length === 0) {
      return { operation, success: false, error: "No open milestones found" };
    }
    const latest = milestones[0];
    return {
      operation,
      success: true,
      itemId: String(latest.number),
      output: milestones,
    };
  }

  async #handleSprintView(
    operation: string,
    params: Record<string, unknown>,
    lastItemId?: string,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? lastItemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      this.#milestoneUrl(itemId),
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    const output = parseJsonOutput(result.stdout) as Record<string, unknown> | undefined;
    return { operation, success: true, itemId, output };
  }

  async #handleSetParent(
    itemId: string,
    parentId: string,
  ): Promise<StepResult> {
    const epicNode = await this.runCommand(
      "gh",
      ["issue", "view", parentId, "--json", "id", ...this.buildRepoArg()],
    );
    if (epicNode.code !== 0) {
      return { operation: "update", success: false, error: epicNode.stderr };
    }
    const featureNode = await this.runCommand(
      "gh",
      ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
    );
    if (featureNode.code !== 0) {
      return { operation: "update", success: false, error: featureNode.stderr };
    }
    const epicNodeId = (JSON.parse(epicNode.stdout) as { id: string }).id;
    const featureNodeId = (JSON.parse(featureNode.stdout) as { id: string }).id;
    const mutation =
      `mutation($epic: ID!, $feature: ID!) { addSubIssue(input: {issueId: $epic, subIssueId: $feature, replaceParent: true}) { issue { id } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${mutation}`,
      "-f",
      `epic=${epicNodeId}`,
      "-f",
      `feature=${featureNodeId}`,
    ]);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }

  async #handleRemoveParent(
    itemId: string,
  ): Promise<StepResult> {
    const featureNode = await this.runCommand(
      "gh",
      ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
    );
    if (featureNode.code !== 0) {
      return { operation: "update", success: false, error: featureNode.stderr };
    }
    const featureNodeId = (JSON.parse(featureNode.stdout) as { id: string }).id;
    const mutation =
      `mutation($feature: ID!) { removeSubIssue(input: {subIssueId: $feature}) { issue { id } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${mutation}`,
      "-f",
      `feature=${featureNodeId}`,
    ]);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }
}
