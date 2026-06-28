import { executeCommand } from "../shared/io/command.ts";
import type { ExecutionResult, Plan, StepResult } from "../domain/types.ts";
import type { PlanGateway } from "../domain/plan-gateway.ts";

export class PlanGatewayAdapter implements PlanGateway {
  constructor(
    private readonly owner: string,
    private readonly repository: string,
  ) {}

  async execute(plan: Plan): Promise<ExecutionResult> {
    if (plan.steps.length === 0) {
      throw new Error("INVALID_INPUT: plan.steps must not be empty");
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
    step: { operation: string; params: Record<string, unknown> },
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
    const result = await executeCommand({ cmd: "gh", args });
    if (result.code !== 0) {
      return { operation: "createItem", success: false, error: result.stderr };
    }
    const url = result.stdout.trim();
    const match = url.match(/\/issues\/(\d+)$/);
    const itemId = match ? match[1] : undefined;

    // node_id を追加取得（グローバル一意識別子）
    let nodeId: string | undefined;
    if (itemId) {
      try {
        const viewResult = await executeCommand({
          cmd: "gh",
          args: ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
        });
        if (viewResult.code === 0) {
          nodeId = JSON.parse(viewResult.stdout).id;
        }
      } catch {
        // node_id の取得に失敗しても作成自体は成功しているので継続
      }
    }

    return { operation: "createItem", success: true, itemId, nodeId, output: { url } };
  }

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
    const result = await executeCommand({ cmd: "gh", args });
    if (result.code !== 0) {
      return { operation: "addComment", success: false, error: result.stderr };
    }
    return { operation: "addComment", success: true, itemId };
  }

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
      result = await executeCommand({ cmd: "gh", args });
      if (result.code !== 0) {
        return { operation: "findItem", success: false, error: result.stderr };
      }
    } catch (e) {
      return { operation: "findItem", success: false, error: String(e) };
    }

    let output: Record<string, unknown>;
    try {
      output = JSON.parse(result.stdout);
    } catch {
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

  private async handleUpdateItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "updateItem", success: false, error: "itemId is required" };
    }
    const title = params.title ? String(params.title) : undefined;
    const bodyAppend = params.bodyAppend ? String(params.bodyAppend) : undefined;

    if (bodyAppend) {
      let viewResult;
      try {
        viewResult = await executeCommand({
          cmd: "gh",
          args: ["issue", "view", itemId, "--json", "body", ...this.buildRepoArg()],
        });
        if (viewResult.code !== 0) {
          return { operation: "updateItem", success: false, error: viewResult.stderr };
        }
      } catch (e) {
        return { operation: "updateItem", success: false, error: String(e) };
      }
      let currentBody: string;
      try {
        currentBody = JSON.parse(viewResult.stdout).body ?? "";
      } catch {
        return { operation: "updateItem", success: false, error: "Failed to parse gh output" };
      }
      const newBody = currentBody + "\n" + bodyAppend;
      const args = [
        "issue",
        "edit",
        itemId,
        "--body",
        newBody,
        ...this.buildRepoArg(),
      ];
      if (title) args.push("--title", title);
      const result = await executeCommand({ cmd: "gh", args });
      if (result.code !== 0) {
        return { operation: "updateItem", success: false, error: result.stderr };
      }
      return { operation: "updateItem", success: true, itemId };
    }

    const args = [
      "issue",
      "edit",
      itemId,
      ...this.buildRepoArg(),
    ];
    if (title) args.push("--title", title);
    const result = await executeCommand({ cmd: "gh", args });
    if (result.code !== 0) {
      return { operation: "updateItem", success: false, error: result.stderr };
    }
    return { operation: "updateItem", success: true, itemId };
  }
}
