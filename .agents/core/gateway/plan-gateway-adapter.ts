import { executeCommand, type ExecuteResult } from "../shared/io/command.ts";
import { logger } from "../shared/io/logger.ts";
import type {
  EntityScope,
  EntityType,
  EpicData,
  ExecutionResult,
  FeatureData,
  Plan,
  Step,
  StepOperation,
  StepResult,
} from "../domain/types.ts";
import { identify } from "../domain/types.ts";
import type { PlanGateway } from "../domain/plan-gateway.ts";
import { ProductBacklogItemHandler } from "./product-backlog-item-handler.ts";
import { WorkPackageHandler } from "./work-package-handler.ts";

export type CommandRunner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Milestone description の `## Velocity` セクションを追記・更新する。
 * 既存セクションがあれば置換し、`## Goal` 等の他セクションは保持する。
 * セクションが1つもない場合は末尾に追記する。
 * 複数の `## Velocity` セクションが存在する場合は全て置換する。
 * 置換後、後続セクションとの間に空行を保証する。
 */
export function upsertVelocitySection(current: string, velocitySection: string): string {
  const velocitySectionRe = /^## Velocity\s*$[\s\S]*?(?=^## |$(?![\s\S]))/gm;
  const matches = [...current.matchAll(velocitySectionRe)];
  if (matches.length === 0) {
    return current.trimEnd() + "\n\n" + velocitySection;
  }
  const firstIndex = matches[0].index;
  const withoutVelocity = current.replace(velocitySectionRe, "");
  const before = withoutVelocity.slice(0, firstIndex).replace(/\s+$/, "");
  const after = withoutVelocity.slice(firstIndex).replace(/^\s+/, "");
  return [before, velocitySection, after].filter((part) => part.length > 0).join("\n\n");
}

function parseJsonOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export type OperationHandler = (
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
  private projectConfig: { productBacklogBoardNumber?: number; sprintBoardNumber?: number } = {};

  constructor(
    readonly runCommand: CommandRunner = (cmd, args) => executeCommand({ cmd, args }),
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
    this.register("Epic", "showHierarchy", async (_op, params) => {
      return await this.#handleShowHierarchy(params);
    });
    this.register("Epic", "showHierarchyAll", async (_op, _params) => {
      return await this.#handleShowHierarchyAll();
    });

    // === Feature 操作の登録 ===
    this.register("Feature", "create", async (_op, params) => {
      const result = await this.handleCreateItem(params, "Feature");
      if (result.success && params.parentEpic && result.itemId) {
        const parentResult = await this.handleSetParent(result.itemId, String(params.parentEpic));
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
        return await this.handleSetParent(itemId, String(params.parentEpic));
      }
      if ("parentEpic" in params) {
        return await this.handleRemoveParent(itemId);
      }
      if (params.title || params.bodyAppend) {
        return await this.handleUpdateItem(params);
      }
      return await this.handleUpdateItem(params);
    });

    // === ProductBacklogItem 操作の登録 ===
    this.register("ProductBacklogItem", "assignToFeature", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "assignToFeature", success: false, error: "itemId is required" };
      }
      const parentFeature = String(params.parentFeature ?? "");
      if (!parentFeature) {
        return { operation: "assignToFeature", success: false, error: "parentFeature is required" };
      }
      return await this.handleSetParent(itemId, parentFeature);
    });
    this.register("ProductBacklogItem", "unassignFromFeature", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "unassignFromFeature", success: false, error: "itemId is required" };
      }
      return await this.handleRemoveParent(itemId);
    });

    // === Sprint (Milestone) 操作の登録 ===
    this.register("Sprint", "create", (op, params) => this.#handleSprintCreate(op, params));
    this.register("Sprint", "endSprint", (op, params) => this.#handleSprintEnd(op, params));
    this.register("Sprint", "setGoal", (op, params) => this.#handleSprintSetGoal(op, params));
    this.register(
      "Sprint",
      "recordVelocity",
      (op, params) => this.#handleSprintRecordVelocity(op, params),
    );
    this.register("Sprint", "setDueDate", (op, params) => this.#handleSprintSetDueDate(op, params));
    this.register("Sprint", "search", (op, params) => this.#handleSprintSearch(op, params));
    this.register(
      "Sprint",
      "view",
      (op, params, lastItemId) => this.#handleSprintView(op, params, lastItemId),
    );
    this.register("Scope", "resolve", (_op, params) => this.handleScopeResolve(params));

    // === ProductBacklogItem 操作の登録 ===
    new ProductBacklogItemHandler(this).register(this.stepHandlers);

    // === WorkPackage 操作の登録 ===
    new WorkPackageHandler(this).register(this.stepHandlers);
  }

  /** テスト用にscopeを直接設定する。通常はScope.resolve Stepで設定される。 */
  setScope(owner: string, repository: string): void {
    this.resolvedScope = { owner, repository };
  }

  /** Product Backlog Board のプロジェクト番号。Handlerから参照される。 */
  get productBacklogBoardNumber(): number | undefined {
    return this.projectConfig.productBacklogBoardNumber;
  }

  /** Sprint Board のプロジェクト番号。Handlerから参照される。 */
  get sprintBoardNumber(): number | undefined {
    return this.projectConfig.sprintBoardNumber;
  }

  /** Project V2 ボード番号を設定する。テスト用および初期化時に使用する。 */
  setProjectBoardNumbers(productBacklog?: number, sprint?: number): void {
    this.projectConfig = {
      productBacklogBoardNumber: productBacklog,
      sprintBoardNumber: sprint,
    };
  }

  /**
   * Issue を Project V2 ボードに追加する。
   * @returns プロジェクト上の item node id
   */
  async addItemToProject(
    issueNodeId: string,
    projectNumber: number,
  ): Promise<{ projectItemNodeId: string }> {
    const getProjectIdQuery =
      `query($owner: String!, $number: Int!) { organization(login: $owner) { projectV2(number: $number) { id } } }`;
    const projectResult = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${getProjectIdQuery}`,
      "-f",
      `owner=${this.resolvedScope?.owner}`,
      "-F",
      `number=${projectNumber}`,
    ]);
    if (projectResult.code !== 0) {
      throw new Error(`Failed to get project ID: ${projectResult.stderr}`);
    }
    let projectData: { data?: { organization?: { projectV2?: { id: string } } } };
    try {
      projectData = JSON.parse(projectResult.stdout);
      const errors = (projectData as { errors?: Array<{ message: string }> }).errors;
      if (errors?.length) {
        throw new Error(`GraphQL error: ${errors.map((e) => e.message).join("; ")}`);
      }
    } catch (e) {
      throw new Error(
        `Failed to parse project ID response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const projectId = projectData?.data?.organization?.projectV2?.id;
    if (!projectId) {
      throw new Error(`Project V2 #${projectNumber} not found`);
    }

    const addItemMutation =
      `mutation($project: ID!, $content: ID!) { addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } } }`;
    const addResult = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${addItemMutation}`,
      "-f",
      `project=${projectId}`,
      "-f",
      `content=${issueNodeId}`,
    ]);
    if (addResult.code !== 0) {
      throw new Error(`Failed to add item to project: ${addResult.stderr}`);
    }
    let addData: {
      data?: { addProjectV2ItemById?: { item?: { id: string } } };
      errors?: Array<{ message: string }>;
    };
    try {
      addData = JSON.parse(addResult.stdout);
    } catch (e) {
      throw new Error(
        `Failed to parse add item response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (addData.errors?.length) {
      const alreadyOnProject = addData.errors.some((e) =>
        e.message.includes("already on the project")
      );
      if (alreadyOnProject && this.resolvedScope) {
        const numQuery = `query($id:ID!){node(id:$id){...on Issue{number}}}`;
        const numResult = await this.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${numQuery}`,
          "-f",
          `id=${issueNodeId}`,
        ]);
        if (numResult.code === 0) {
          const numData = JSON.parse(numResult.stdout) as { data?: { node?: { number?: number } } };
          const issueNum = numData?.data?.node?.number;
          if (issueNum) {
            const lookupQuery =
              `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
            const lookupResult = await this.runCommand("gh", [
              "api",
              "graphql",
              "-f",
              `query=${lookupQuery}`,
              "-f",
              `owner=${this.resolvedScope.owner}`,
              "-f",
              `repo=${this.resolvedScope.repository}`,
              "-F",
              `num=${issueNum}`,
            ]);
            if (lookupResult.code === 0) {
              const lookupData = JSON.parse(lookupResult.stdout) as {
                data?: {
                  repository?: {
                    issue?: {
                      projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
                    };
                  };
                };
              };
              const matched = lookupData?.data?.repository?.issue?.projectItems?.nodes
                ?.find((n) => n.project.number === projectNumber);
              if (matched) return { projectItemNodeId: matched.id };
            }
          }
        }
      }
      throw new Error(`GraphQL error: ${addData.errors.map((e) => e.message).join("; ")}`);
    }
    const projectItemNodeId = addData?.data?.addProjectV2ItemById?.item?.id;
    if (!projectItemNodeId) {
      throw new Error("Failed to get project item node ID");
    }
    return { projectItemNodeId };
  }

  /** プロジェクトV2の単一選択フィールドのオプション名からIDを解決する。 */
  async resolveSingleSelectOptionId(
    projectNumber: number,
    fieldName: string,
    optionName: string,
  ): Promise<string | undefined> {
    const owner = this.resolvedScope?.owner;
    if (!owner) return undefined;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      "query=query($owner: String!, $number: Int!, $field: String!) { organization(login: $owner) { projectV2(number: $number) { field(name: $field) { ... on ProjectV2SingleSelectField { options { id name } } } } } }",
      "-f",
      `owner=${owner}`,
      "-F",
      `number=${projectNumber}`,
      "-f",
      `field=${fieldName}`,
    ]);
    if (result.code !== 0) return undefined;
    try {
      const data = JSON.parse(result.stdout) as {
        data?: {
          organization?: {
            projectV2?: { field?: { options: Array<{ id: string; name: string }> } };
          };
        };
      };
      return data?.data?.organization?.projectV2?.field?.options
        ?.find((o) => o.name === optionName)?.id;
    } catch {
      return undefined;
    }
  }

  /** フィールド名からフィールドIDを解決する（内部ヘルパー）。 */
  private async resolveFieldId(
    projectNumber: number,
    fieldName: string,
  ): Promise<{ fieldId: string } | { error: string }> {
    const query =
      `query($owner: String!, $number: Int!, $fieldName: String!) { organization(login: $owner) { projectV2(number: $number) { field(name: $fieldName) { ... on ProjectV2SingleSelectField { id } ... on ProjectV2Field { id } } } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${this.resolvedScope?.owner}`,
      "-F",
      `number=${projectNumber}`,
      "-f",
      `fieldName=${fieldName}`,
    ]);
    if (result.code !== 0) return { error: result.stderr };
    try {
      const data = JSON.parse(result.stdout) as {
        data?: { organization?: { projectV2?: { field?: { id: string } } } };
      };
      const fieldId = data?.data?.organization?.projectV2?.field?.id;
      if (!fieldId) return { error: `Field "${fieldName}" not found` };
      return { fieldId };
    } catch {
      return { error: "Failed to parse field query response" };
    }
  }

  /** Project V2 フィールドに単一選択値を設定する。 */
  /** プロジェクト番号からプロジェクトノードIDを解決する。 */
  private async resolveProjectNodeId(
    projectNumber: number,
  ): Promise<{ projectId: string } | { error: string }> {
    const query =
      `query($owner: String!, $number: Int!) { organization(login: $owner) { projectV2(number: $number) { id } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${this.resolvedScope?.owner}`,
      "-F",
      `number=${projectNumber}`,
    ]);
    if (result.code !== 0) return { error: result.stderr };
    try {
      const data = JSON.parse(result.stdout) as {
        data?: { organization?: { projectV2?: { id: string } } };
      };
      const projectId = data?.data?.organization?.projectV2?.id;
      if (!projectId) return { error: "Project not found" };
      return { projectId };
    } catch {
      return { error: "Failed to parse project query response" };
    }
  }

  /** Project V2 フィールドに単一選択値を設定する。 */
  async setSingleSelectFieldValue(
    projectItemNodeId: string,
    projectNumber: number,
    fieldName: string,
    optionId: string,
  ): Promise<StepResult> {
    const [resolved1, resolved2] = await Promise.all([
      this.resolveFieldId(projectNumber, fieldName),
      this.resolveProjectNodeId(projectNumber),
    ]);
    if ("error" in resolved1) {
      return { operation: "updateField", success: false, error: resolved1.error };
    }
    if ("error" in resolved2) {
      return { operation: "updateField", success: false, error: resolved2.error };
    }
    const result = await this.runCommand("gh", [
      "project",
      "item-edit",
      "--project-id",
      resolved2.projectId,
      "--id",
      projectItemNodeId,
      "--field-id",
      resolved1.fieldId,
      "--single-select-option-id",
      optionId,
    ]);
    if (result.code !== 0) {
      return { operation: "updateField", success: false, error: result.stderr };
    }
    return { operation: "updateField", success: true };
  }

  /** IssueのV2ボード上のStatusを設定する（stage値→V2 Status名に自動変換）。 */
  async setBoardStatus(itemId: string, boardNumber: number, stage: string): Promise<void> {
    const stageToStatus: Record<string, string> = {
      todo: "Todo",
      inProgress: "In Progress",
      done: "Done",
    };
    const statusName = stageToStatus[stage];
    if (!statusName) return;
    const nodeResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "id",
      ...this.buildRepoArg(),
    ]);
    if (nodeResult.code !== 0) return;
    try {
      const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
      const { projectItemNodeId } = await this.addItemToProject(nodeData.id, boardNumber);
      const optionId = await this.resolveSingleSelectOptionId(boardNumber, "Status", statusName);
      if (optionId) {
        await this.setSingleSelectFieldValue(projectItemNodeId, boardNumber, "Status", optionId);
      }
    } catch {
      // non-critical
    }
  }

  /** Project V2 アイテムのテキストフィールド値を読み取る。 */
  async readTextFieldValue(
    projectItemNodeId: string,
    _projectNumber: number,
    fieldName: string,
  ): Promise<string | undefined> {
    const query =
      `query($item: ID!) { node(id: $item) { ... on ProjectV2Item { fv: fieldValueByName(name: "${fieldName}") { ... on ProjectV2ItemFieldTextValue { text } } } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `item=${projectItemNodeId}`,
    ]);
    if (result.code !== 0) return undefined;
    try {
      const data = JSON.parse(result.stdout) as {
        data?: { node?: { fv?: { text?: string } } };
      };
      return data?.data?.node?.fv?.text;
    } catch {
      return undefined;
    }
  }

  /** Project V2 フィールドに数値を設定する。 */
  async setNumberFieldValue(
    projectItemNodeId: string,
    projectNumber: number,
    fieldName: string,
    numberValue: number,
  ): Promise<StepResult> {
    const [resolved1, resolved2] = await Promise.all([
      this.resolveFieldId(projectNumber, fieldName),
      this.resolveProjectNodeId(projectNumber),
    ]);
    if ("error" in resolved1) {
      return { operation: "updateField", success: false, error: resolved1.error };
    }
    if ("error" in resolved2) {
      return { operation: "updateField", success: false, error: resolved2.error };
    }
    const result = await this.runCommand("gh", [
      "project",
      "item-edit",
      "--project-id",
      resolved2.projectId,
      "--id",
      projectItemNodeId,
      "--field-id",
      resolved1.fieldId,
      "--number",
      String(numberValue),
    ]);
    if (result.code !== 0) {
      return { operation: "updateField", success: false, error: result.stderr };
    }
    return { operation: "updateField", success: true };
  }

  /** Project V2 フィールドにテキスト値を設定する。 */
  async setTextFieldValue(
    projectItemNodeId: string,
    projectNumber: number,
    fieldName: string,
    text: string,
  ): Promise<StepResult> {
    const [resolved1, resolved2] = await Promise.all([
      this.resolveFieldId(projectNumber, fieldName),
      this.resolveProjectNodeId(projectNumber),
    ]);
    if ("error" in resolved1) {
      return { operation: "updateField", success: false, error: resolved1.error };
    }
    if ("error" in resolved2) {
      return { operation: "updateField", success: false, error: resolved2.error };
    }
    const result = await this.runCommand("gh", [
      "project",
      "item-edit",
      "--project-id",
      resolved2.projectId,
      "--id",
      projectItemNodeId,
      "--field-id",
      resolved1.fieldId,
      "--text",
      text,
    ]);
    if (result.code !== 0) {
      return { operation: "updateField", success: false, error: result.stderr };
    }
    return { operation: "updateField", success: true };
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
      const sshMatch = remoteUrl.match(/^git@[^:]+:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (sshMatch) {
        this.resolvedScope = { owner: sshMatch[1], repository: sshMatch[2] };
        return {
          operation: "resolve",
          success: true,
          itemId: `${sshMatch[1]}/${sshMatch[2]}`,
          output: { owner: sshMatch[1], repository: sshMatch[2] },
        };
      }
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

  async handleSetMilestone(itemId: string, sprint: string): Promise<StepResult> {
    const sprintArgs = [
      "issue",
      "edit",
      itemId,
      "--milestone",
      sprint,
      ...this.buildRepoArg(),
    ];
    const result = await this.runCommand("gh", sprintArgs);
    if (result.code !== 0) {
      return { operation: "commit", success: false, error: result.stderr };
    }
    return { operation: "commit", success: true, itemId };
  }

  async handleCloseItem(params: Record<string, unknown>): Promise<StepResult> {
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

  /** 現在のスコープのowner名を返す。Handlerから参照される。 */
  get scopeOwner(): string | undefined {
    return this.resolvedScope?.owner;
  }

  /** 現在のスコープのrepository名を返す。Handlerから参照される。 */
  get scopeRepository(): string | undefined {
    return this.resolvedScope?.repository;
  }

  buildRepoArg(): string[] {
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
  async handleCreateItem(
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
  async handleAddComment(
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
   * Review Issue 本文を「スプリント開始時検証計画」「スプリント中追加検証計画」に分割する。
   *
   * 開始時検証計画の旧AC（➖論理削除含む）と、スプリント中追加検証計画の新ACは
   * 同じPBI番号・WP番号・AC番号を持ち得るため、セクションをアンカーにして
   * 誤マッチ（追加ACが開始時検証計画の同番号ACを上書きする）を防ぐために使う。
   */
  private splitReviewSections(
    body: string,
  ): { beforeStart: string; startSection: string; addedSection: string } {
    const startMarker = "## スプリント開始時検証計画";
    const addedMarker = "## スプリント中追加検証計画";
    const startIdx = body.indexOf(startMarker);
    const addedIdx = body.indexOf(addedMarker);
    let beforeStart = "";
    let startSection = "";
    let addedSection = "";
    if (startIdx >= 0) {
      beforeStart = body.slice(0, startIdx);
      startSection = body.slice(startIdx, addedIdx >= 0 ? addedIdx : body.length);
    }
    if (addedIdx >= 0) {
      addedSection = body.slice(addedIdx);
    }
    if (startIdx < 0 && addedIdx < 0) {
      beforeStart = body;
    }
    return { beforeStart, startSection, addedSection };
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
      | Array<{
        pbiNumber?: number;
        wpNumber?: string;
        acJudgments: Array<{ number: string; judgment: string }>;
      }>
      | undefined;

    let newBody = currentBody;

    let { beforeStart, startSection, addedSection } = this.splitReviewSections(newBody);

    // 対象セクション内の AC マーカーを置換する。論理削除済み（➖）は上書きしない。
    // 置換対象セクションは「追加検証計画 → 開始時検証計画 → 全体（フォールバック）」の順。
    const replaceInSection = (
      section: string,
      pbiNumber: number | undefined,
      wpNumber: string | undefined,
      acNumber: string,
      marker: string,
    ): { section: string; replaced: boolean } => {
      let replaced = false;
      if (pbiNumber !== undefined && wpNumber !== undefined) {
        const escapedWp = String(wpNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const contextPattern = new RegExp(
          `(### 📦 PBI: \\[${pbiNumber}\\][\\s\\S]*?#### WP_${escapedWp}:.*?\\n[\\s\\S]*?)([❔✅❌⚠️])\\s*(AC_${acNumber}:)`,
        );
        if (contextPattern.test(section)) {
          section = section.replace(contextPattern, `$1${marker} $3`);
          replaced = true;
        }
      }
      if (!replaced) {
        const acPattern = new RegExp(`([❔✅❌⚠️])\\s*(AC_${acNumber}:)`);
        if (acPattern.test(section)) {
          section = section.replace(acPattern, `${marker} $2`);
          replaced = true;
        }
      }
      return { section, replaced };
    };

    if (postPlanAcGroups) {
      for (const group of postPlanAcGroups) {
        for (const ac of group.acJudgments) {
          const marker = ac.judgment === "pass" ? "✅" : ac.judgment === "fail" ? "❌" : "⚠️";
          const pbiNumber = group.pbiNumber;
          const wpNumber = group.wpNumber;

          let r = replaceInSection(addedSection, pbiNumber, wpNumber, ac.number, marker);
          addedSection = r.section;
          if (!r.replaced) {
            r = replaceInSection(startSection, pbiNumber, wpNumber, ac.number, marker);
            startSection = r.section;
          }
          if (!r.replaced) {
            r = replaceInSection(beforeStart, pbiNumber, wpNumber, ac.number, marker);
            beforeStart = r.section;
          }
        }
      }
      newBody = beforeStart + startSection + addedSection;
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

    let { beforeStart, startSection, addedSection } = this.splitReviewSections(currentBody);
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

    // スコープ指定された AC を論理削除（➖）する。
    // 追加検証計画セクション → 開始時検証計画セクション → 全体（フォールバック）の順に置換し、
    // 同番号の旧ACを誤って削除することを防ぐ。
    const removeAcInSection = (
      section: string,
      item: { pbiNumber: number; wpNumber: string; number: string; description: string },
    ): { section: string; removed: boolean } => {
      const acNum = String(item.number);
      const pbiMarker = `### 📦 PBI: [${item.pbiNumber}]`;
      const wpMarker = `#### WP_${item.wpNumber}:`;
      const re = new RegExp(
        `(${escapeRegex(pbiMarker)}[\\s\\S]*?${escapeRegex(wpMarker)}[\\s\\S]*?)- [❔✅⚠️❌] AC_${
          escapeRegex(acNum)
        }:.*`,
      );
      let removed = false;
      if (re.test(section)) {
        section = section.replace(re, `$1- ➖ AC_${acNum}: ${item.description}`);
        removed = true;
      }
      return { section, removed };
    };

    if (removedScoped?.length) {
      for (const item of removedScoped) {
        let r = removeAcInSection(addedSection, item);
        addedSection = r.section;
        if (!r.removed) {
          r = removeAcInSection(startSection, item);
          startSection = r.section;
        }
        if (!r.removed) {
          r = removeAcInSection(beforeStart, item);
          beforeStart = r.section;
        }
      }
      newBody = beforeStart + startSection + addedSection;
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
   * gh issue view に加え、GraphQL で parent/milestone を追加取得する。
   * @param params.itemId - 取得対象の Issue 番号
   * @returns Issue の詳細情報（number, title, body, labels, comments, parent, milestone）を含む StepResult
   */
  async handleFindItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "view", success: false, error: "itemId is required" };
    }
    const args = [
      "issue",
      "view",
      itemId,
      "--json",
      "number,title,body,labels,comments,id",
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

    if (this.resolvedScope) {
      try {
        const enrichQuery =
          `query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { issue(number: $number) { parent { ... on Issue { number title id } } milestone { number title } subIssues(first: 100) { nodes { ... on Issue { number title id } } } projectItems(first: 10) { nodes { id project { title number } sizeEst: fieldValueByName(name: "harness-size-estimate") { ... on ProjectV2ItemFieldSingleSelectValue { name } } sizeAct: fieldValueByName(name: "harness-size-actual") { ... on ProjectV2ItemFieldSingleSelectValue { name } } status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }`;
        const gqlResult = await this.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${enrichQuery}`,
          "-f",
          `owner=${this.resolvedScope.owner}`,
          "-f",
          `repo=${this.resolvedScope.repository}`,
          "-F",
          `number=${parseInt(itemId, 10)}`,
        ]);
        if (gqlResult.code === 0) {
          const gqlData = JSON.parse(gqlResult.stdout) as {
            data?: {
              repository?: {
                issue?: {
                  parent?: { number: number; title: string; id: string } | null;
                  milestone?: { number: number; title: string } | null;
                  subIssues?: {
                    nodes: Array<{ number: number; title: string; id: string }> | null;
                  };
                  projectItems?: {
                    nodes:
                      | Array<{
                        id: string;
                        project: { title: string; number: number };
                        sizeEst?: { name: string } | null;
                        sizeAct?: { name: string } | null;
                        status?: { name: string } | null;
                      }>
                      | null;
                  };
                };
              };
            };
          };
          const issue = gqlData?.data?.repository?.issue;
          if (issue) {
            const scope = this.resolvedScope;
            if (issue.parent) {
              output.parent = identify(
                scope,
                issue.parent.title,
                issue.parent.id,
                String(issue.parent.number),
              );
            }
            if (issue.milestone) {
              output.milestone = identify(
                scope,
                issue.milestone.title,
                String(issue.milestone.number),
                String(issue.milestone.number),
              );
            }
            if (issue.subIssues?.nodes) {
              output.children = issue.subIssues.nodes.map((
                n: { number: number; title: string; id: string },
              ) => identify(scope, n.title, n.id, String(n.number)));
            }
            if (issue.projectItems?.nodes) {
              output.projectItems = issue.projectItems.nodes.map((item) => ({
                project: item.project,
                itemId: item.id,
                sizeEstimate: item.sizeEst?.name ?? null,
                sizeActual: item.sizeAct?.name ?? null,
                status: item.status?.name ?? null,
              }));
            }
          }
        }
      } catch { /* enrichment is best-effort */ }
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
  async handleSearchItems(params: Record<string, unknown>): Promise<StepResult> {
    const type = String(params.type ?? params.labelType ?? "");
    if (!type) {
      return { operation: "search", success: false, error: "type is required" };
    }
    const keyword = String(params.keyword ?? "");
    if (keyword) {
      return {
        operation: "search",
        success: false,
        error: "keyword search is not yet implemented",
      };
    }
    const state = String(params.state ?? "open");
    const args = [
      "issue",
      "list",
      "--label",
      `type:${type}`,
      "--json",
      "number,title,labels",
      "--state",
      state,
      ...this.buildRepoArg(),
    ];
    const sprintNumber = params.sprintNumber;
    if (sprintNumber !== undefined && sprintNumber !== "") {
      args.push("--milestone", `Sprint ${sprintNumber}`);
    }
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
   * Project V2 Board の Status フィールドでアイテムを検索する。
   * @param params.status - 検索する Status 名（"Todo", "In Progress", "Done" 等）
   * @param params.labelType - ラベル種別（例: "PBI"）
   * @param params.boardNumber - Project V2 ボード番号
   */
  async handleProjectSearchItems(params: Record<string, unknown>): Promise<StepResult> {
    const status = String(params.status ?? "");
    const labelType = String(params.labelType ?? "");
    const boardNumber = Number(params.boardNumber ?? 0);
    if (!status || !labelType || !boardNumber) {
      return {
        operation: "search",
        success: false,
        error: "status, labelType, and boardNumber are required",
      };
    }
    const keyword = String(params.keyword ?? "");
    if (keyword) {
      return {
        operation: "search",
        success: false,
        error: "keyword search is not yet implemented",
      };
    }
    const owner = this.resolvedScope?.owner;
    if (!owner) return { operation: "search", success: false, error: "Scope not resolved" };

    // sprintNumber が指定されていれば、該当 Sprint に属する Issue 番号一覧を先に取得
    let sprintIssueNumbers: Set<number> | undefined;
    const sprintNumber = params.sprintNumber;
    if (sprintNumber !== undefined && sprintNumber !== "") {
      const msResult = await this.runCommand("gh", [
        "issue",
        "list",
        "--milestone",
        `Sprint ${sprintNumber}`,
        "--json",
        "number",
        "--state",
        "all",
        ...this.buildRepoArg(),
      ]);
      if (msResult.code === 0) {
        const msData = parseJsonOutput(msResult.stdout);
        if (Array.isArray(msData)) {
          sprintIssueNumbers = new Set(msData.map((i: { number: number }) => i.number));
        }
      }
    }

    const listResult = await this.runCommand("gh", [
      "project",
      "item-list",
      String(boardNumber),
      "--owner",
      owner,
      "--format",
      "json",
    ]);
    if (listResult.code !== 0) {
      return { operation: "search", success: false, error: listResult.stderr };
    }
    try {
      const data = JSON.parse(listResult.stdout) as {
        items: Array<{
          id: string;
          content?: { number: number; title: string } | null;
          status?: string | null;
          labels?: Array<{ name: string }>;
        }>;
      };
      const matched = data.items.filter((item) => {
        if (!item.content) return false;
        if (status === "__none__") {
          if (item.status != null) return false;
        } else {
          if ((item.status ?? null) !== status) return false;
        }
        if (sprintIssueNumbers && !sprintIssueNumbers.has(item.content!.number)) return false;
        return true;
      });
      return {
        operation: "search",
        success: true,
        output: matched.map((item) => ({
          number: item.content!.number,
          title: item.content!.title,
        })),
      };
    } catch (e) {
      return { operation: "search", success: false, error: `Failed to parse project search: ${e}` };
    }
  }

  async #handleShowHierarchy(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "showHierarchy", success: false, error: "itemId is required" };
    }
    if (!this.resolvedScope) {
      return { operation: "showHierarchy", success: false, error: "Scope not resolved" };
    }

    const query = `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          number
          title
          body
          subIssues(first: 100) {
            nodes {
              ... on Issue {
                number
                title
                body
                labels(first: 10) { nodes { name } }
              }
            }
          }
        }
      }
    }`;

    let graphqlResult;
    try {
      graphqlResult = await this.runCommand("gh", [
        "api",
        "graphql",
        "-f",
        `query=${query}`,
        "-f",
        `owner=${this.resolvedScope.owner}`,
        "-f",
        `repo=${this.resolvedScope.repository}`,
        "-F",
        `number=${parseInt(itemId, 10)}`,
      ]);
    } catch (e) {
      return { operation: "showHierarchy", success: false, error: String(e) };
    }
    if (graphqlResult.code !== 0) {
      return { operation: "showHierarchy", success: false, error: graphqlResult.stderr };
    }

    const parsed = parseJsonOutput(graphqlResult.stdout);
    if (parsed === undefined) {
      return {
        operation: "showHierarchy",
        success: false,
        error: "Invalid response from GitHub API",
      };
    }

    const data = parsed as {
      errors?: Array<{ message: string }>;
      data?: {
        repository?: {
          issue: {
            number: number;
            title: string;
            body: string;
            subIssues: {
              nodes:
                | Array<{
                  number: number;
                  title: string;
                  body: string;
                  labels: { nodes: Array<{ name: string }> };
                }>
                | null;
            };
          } | null;
        };
      };
    };

    if (data.errors && data.errors.length > 0) {
      return {
        operation: "showHierarchy",
        success: false,
        error: `GraphQL error: ${data.errors.map((e) => e.message).join("; ")}`,
      };
    }

    const issue = data?.data?.repository?.issue;
    if (!issue) {
      return { operation: "showHierarchy", success: false, error: "Epic not found" };
    }

    const featureList: FeatureData[] = (issue.subIssues?.nodes ?? []).map((node) => ({
      identifier: identify(
        this.resolvedScope!,
        node.title,
        undefined,
        String(node.number),
      ),
      statement: { description: node.body ?? "" },
      state: "open" as const,
    }));

    const epicData: EpicData = {
      identifier: identify(
        this.resolvedScope!,
        issue.title,
        undefined,
        String(issue.number),
      ),
      statement: { description: issue.body ?? "" },
      state: "open" as const,
      features: { items: featureList, totalCount: featureList.length },
    };

    return {
      operation: "showHierarchy",
      success: true,
      itemId,
      output: epicData,
    };
  }

  async #handleShowHierarchyAll(): Promise<StepResult> {
    if (!this.resolvedScope) {
      return { operation: "showHierarchyAll", success: false, error: "Scope not resolved" };
    }

    const listResult = await this.runCommand("gh", [
      "issue",
      "list",
      "--label",
      "type:Epic",
      "--json",
      "number,title,body",
      "--state",
      "open",
      ...this.buildRepoArg(),
    ]);
    if (listResult.code !== 0) {
      return { operation: "showHierarchyAll", success: false, error: listResult.stderr };
    }

    const epics = parseJsonOutput(listResult.stdout) as
      | Array<{ number: number; title: string; body: string }>
      | undefined;
    if (!epics || epics.length === 0) {
      return {
        operation: "showHierarchyAll",
        success: true,
        output: { items: [], totalCount: 0 },
      };
    }

    const query = `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          number
          title
          body
          subIssues(first: 100) {
            nodes {
              ... on Issue {
                number
                title
                body
                labels(first: 10) { nodes { name } }
              }
            }
          }
        }
      }
    }`;

    const epicDataList: EpicData[] = [];
    for (const epic of epics) {
      let graphqlResult;
      try {
        graphqlResult = await this.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${query}`,
          "-f",
          `owner=${this.resolvedScope.owner}`,
          "-f",
          `repo=${this.resolvedScope.repository}`,
          "-F",
          `number=${epic.number}`,
        ]);
      } catch {
        continue;
      }
      if (graphqlResult.code !== 0) continue;

      const parsed = parseJsonOutput(graphqlResult.stdout) as {
        data?: {
          repository?: {
            issue?: {
              number: number;
              title: string;
              body: string;
              subIssues: {
                nodes:
                  | Array<
                    {
                      number: number;
                      title: string;
                      body: string;
                      labels: { nodes: Array<{ name: string }> };
                    }
                  >
                  | null;
              };
            } | null;
          };
        };
      } | undefined;
      const issue = parsed?.data?.repository?.issue;
      if (!issue) continue;

      const featureList: FeatureData[] = (issue.subIssues?.nodes ?? []).map((node) => ({
        identifier: identify(this.resolvedScope!, node.title, undefined, String(node.number)),
        statement: { description: node.body ?? "" },
        state: "open" as const,
      }));

      epicDataList.push({
        identifier: identify(this.resolvedScope!, issue.title, undefined, String(issue.number)),
        statement: { description: issue.body ?? "" },
        state: "open" as const,
        features: { items: featureList, totalCount: featureList.length },
      });
    }

    return {
      operation: "showHierarchyAll",
      success: true,
      output: { items: epicDataList, totalCount: epicDataList.length },
    };
  }

  /**
   * updateItem 操作を処理する。GitHub Issue のタイトル更新および本文操作を行う。
   * @param params.itemId - 更新対象の Issue 番号
   * @param params.title - 新しいタイトル（省略時は変更なし）
   * @param params.body - 既存本文を全文置換する内容（省略時は置換なし）。
   *                       bodyAppend と同時指定された場合は bodyAppend が優先される。
   * @param params.bodyAppend - 既存本文に追記する内容（省略時は追記なし）。
   *                            body より優先される。
   * @returns 更新結果の StepResult
   */
  async handleUpdateItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "update", success: false, error: "itemId is required" };
    }
    const title = params.title ? String(params.title) : undefined;
    const body = params.body ? String(params.body) : undefined;
    const bodyAppend = params.bodyAppend ? String(params.bodyAppend) : undefined;

    if (bodyAppend) {
      return await this.updateItemWithBodyAppend(itemId, title, bodyAppend);
    }

    if (body) {
      return await this.updateItemWithFullBody(itemId, title, body);
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

  private async updateItemWithFullBody(
    itemId: string,
    title: string | undefined,
    body: string,
  ): Promise<StepResult> {
    const args = ["issue", "edit", itemId, "--body", body, ...this.buildRepoArg()];
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
      const stderr = result.stderr ?? "";
      if (stderr.includes("HTTP 422") || stderr.includes("already exists")) {
        return {
          operation,
          success: false,
          error: `Milestone "${title}" already exists. Each sprint number must be unique.`,
        };
      }
      return { operation, success: false, error: stderr };
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

    const viewResult = await this.runCommand("gh", [
      "api",
      this.#milestoneUrl(itemId),
    ]);
    if (viewResult.code !== 0) {
      return { operation, success: false, error: viewResult.stderr };
    }
    const milestone = parseJsonOutput(viewResult.stdout) as { description?: string } | undefined;
    const current = milestone?.description ?? "";

    const velocitySectionRe = /^## Velocity\s*$[\s\S]*?(?=^## |$(?![\s\S]))/gm;
    const velocityMatches = current.match(velocitySectionRe) ?? [];
    const newDescription = velocityMatches.length > 0
      ? `${description.trimEnd()}\n\n${velocityMatches.join("\n")}`
      : description;

    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `description=${newDescription}`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  /**
   * recordVelocity 操作を処理する。Milestone description に `## Velocity` セクションを追記し、
   * 既存の `## Goal` セクションと同居させる。
   * @param params.itemId - 対象 Milestone の番号
   * @param params.velocity - ベロシティ集計値（sprintNumber, pbiCount, totalWeight, matchRate, summary）
   */
  async #handleSprintRecordVelocity(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const velocity = params.velocity as
      | {
        sprintNumber: number;
        pbiCount: number;
        totalWeight: number;
        matchRate: number;
        summary: string;
      }
      | undefined;
    if (!velocity) {
      return { operation, success: false, error: "velocity is required" };
    }

    const viewResult = await this.runCommand("gh", [
      "api",
      this.#milestoneUrl(itemId),
    ]);
    if (viewResult.code !== 0) {
      return { operation, success: false, error: viewResult.stderr };
    }
    const milestone = parseJsonOutput(viewResult.stdout) as { description?: string } | undefined;
    const current = milestone?.description ?? "";

    const velocityLine = `${velocity.pbiCount} PBI / ${velocity.totalWeight} points / ${
      Math.round(velocity.matchRate * 100)
    }% 一致 / ${String(velocity.summary ?? "").replace(/\s+/g, " ").trim()}`;
    const velocitySection = `## Velocity\n\n${velocityLine}`;

    const newDescription = upsertVelocitySection(current, velocitySection);

    const updateResult = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `description=${newDescription}`,
    ]);
    if (updateResult.code !== 0) {
      return { operation, success: false, error: updateResult.stderr };
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

  async handleSetParent(
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

  async handleRemoveParent(
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
    const parentQuery =
      `query { node(id: "${featureNodeId}") { ... on Issue { parent { ... on Issue { id } } } } }`;
    const parentResult = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${parentQuery}`,
    ]);
    if (parentResult.code !== 0) {
      return { operation: "update", success: false, error: parentResult.stderr };
    }
    const parentData = JSON.parse(parentResult.stdout) as {
      data?: { node?: { parent?: { id: string } | null } };
    };
    const parentNodeId = parentData?.data?.node?.parent?.id;
    if (!parentNodeId) {
      return { operation: "update", success: true, itemId };
    }
    const mutation =
      `mutation($parent: ID!, $feature: ID!) { removeSubIssue(input: {issueId: $parent, subIssueId: $feature}) { issue { id } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${mutation}`,
      "-f",
      `parent=${parentNodeId}`,
      "-f",
      `feature=${featureNodeId}`,
    ]);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }
}
