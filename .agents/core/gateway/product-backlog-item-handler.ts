import type { EntityType, StepOperation } from "../domain/types.ts";
import type { OperationHandler, PlanGatewayAdapter } from "./plan-gateway-adapter.ts";

export class ProductBacklogItemHandler {
  constructor(private readonly adapter: PlanGatewayAdapter) {}

  register(stepHandlers: Map<EntityType, Map<StepOperation, OperationHandler>>): void {
    const handlers = new Map<StepOperation, OperationHandler>();

    handlers.set("propose", async (_op, params) => {
      const result = await this.adapter.handleCreateItem({ ...params, type: "PBI" });
      if (!result.success || !result.itemId) return result;
      const parentFeature = String(params.parentFeature ?? "");
      if (parentFeature) {
        const pr = await this.adapter.handleSetParent(result.itemId, parentFeature);
        if (!pr.success) return pr;
      }
      if (result.nodeId && this.adapter.productBacklogBoardNumber) {
        try {
          await this.adapter.addItemToProject(
            result.nodeId,
            this.adapter.productBacklogBoardNumber,
          );
        } catch { /* ok */ }
      }
      return result;
    });

    handlers.set("commit", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "commit", success: false, error: "itemId is required" };
      const sprint = String(params.sprint ?? "");
      if (sprint) {
        const mr = await this.adapter.handleSetMilestone(itemId, sprint);
        if (!mr.success) return mr;
      }
      if (this.adapter.productBacklogBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          this.adapter.productBacklogBoardNumber,
          String(params.stage ?? "todo"),
        );
      }
      return { operation: "commit", success: true, itemId };
    });

    handlers.set("start", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "start", success: false, error: "itemId is required" };
      if (this.adapter.productBacklogBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          this.adapter.productBacklogBoardNumber,
          String(params.stage ?? "inProgress"),
        );
      }
      return { operation: "start", success: true, itemId };
    });

    handlers.set("complete", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "complete", success: false, error: "itemId is required" };
      if (this.adapter.productBacklogBoardNumber) {
        await this.adapter.setBoardStatus(
          itemId,
          this.adapter.productBacklogBoardNumber,
          String(params.stage ?? "done"),
        );
      }
      return { operation: "complete", success: true, itemId };
    });

    handlers.set("update", async (_op, params) => {
      return await this.adapter.handleUpdateItem(params);
    });

    handlers.set("archive", async (_op, params) => {
      return await this.adapter.handleCloseItem(params);
    });

    handlers.set("estimateSize", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "estimateSize", success: false, error: "itemId is required" };
      }
      const sizeVal = String(params.sizeEstimate ?? "");
      if (sizeVal && this.adapter.productBacklogBoardNumber) {
        const nodeResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "id",
          ...this.adapter.buildRepoArg(),
        ]);
        if (nodeResult.code === 0) {
          try {
            const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
            const { projectItemNodeId } = await this.adapter.addItemToProject(
              nodeData.id,
              this.adapter.productBacklogBoardNumber,
            );
            const optionId = await this.adapter.resolveSingleSelectOptionId(
              this.adapter.productBacklogBoardNumber,
              "harness-size-estimate",
              sizeVal,
            );
            if (optionId) {
              await this.adapter.setSingleSelectFieldValue(
                projectItemNodeId,
                this.adapter.productBacklogBoardNumber,
                "harness-size-estimate",
                optionId,
              );
            }
          } catch { /* ok */ }
        }
      }
      return { operation: "estimateSize", success: true, itemId };
    });

    handlers.set("confirmSize", async (_op, params) => {
      const { PbiEffortAnalysisData } = await import("./pbi-effort-analysis-data.ts");
      const itemId = String(params.itemId ?? "");
      if (!itemId) return { operation: "confirmSize", success: false, error: "itemId is required" };
      const sizeActual = String(params.sizeActual ?? "");
      const varianceReason = String(params.sizeVarianceReason ?? "");
      if ((sizeActual || varianceReason) && this.adapter.productBacklogBoardNumber) {
        const nodeResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "id",
          ...this.adapter.buildRepoArg(),
        ]);
        if (nodeResult.code === 0) {
          try {
            const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
            let projectItemNodeId: string;
            try {
              ({ projectItemNodeId } = await this.adapter.addItemToProject(
                nodeData.id,
                this.adapter.productBacklogBoardNumber,
              ));
            } catch {
              const owned = this.adapter.scopeOwner;
              const repod = this.adapter.scopeRepository;
              if (!owned || !repod) return { operation: "confirmSize", success: true, itemId };
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
              if (lr.code !== 0) return { operation: "confirmSize", success: true, itemId };
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
                n.project.number === this.adapter.productBacklogBoardNumber!
              );
              if (!matched) return { operation: "confirmSize", success: true, itemId };
              projectItemNodeId = matched.id;
            }
            if (sizeActual) {
              const optionId = await this.adapter.resolveSingleSelectOptionId(
                this.adapter.productBacklogBoardNumber,
                "harness-size-actual",
                sizeActual,
              );
              if (optionId) {
                await this.adapter.setSingleSelectFieldValue(
                  projectItemNodeId,
                  this.adapter.productBacklogBoardNumber,
                  "harness-size-actual",
                  optionId,
                );
              }
            }
            if (varianceReason) {
              const text = await this.adapter.readTextFieldValue(
                projectItemNodeId,
                this.adapter.productBacklogBoardNumber,
                "harness-efforts-analysis",
              );
              const data = PbiEffortAnalysisData.fromJson(text ?? "").setSizeVarianceReview(
                varianceReason,
              );
              await this.adapter.setTextFieldValue(
                projectItemNodeId,
                this.adapter.productBacklogBoardNumber,
                "harness-efforts-analysis",
                data.toJson(),
              );
            }
          } catch { /* ok */ }
        }
      }
      return { operation: "confirmSize", success: true, itemId };
    });

    handlers.set("recordAnalysis", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "recordAnalysis", success: false, error: "itemId is required" };
      }
      if (params.body && this.adapter.productBacklogBoardNumber) {
        try {
          const body = String(params.body);
          const extract = (heading: string): string | undefined => {
            const re = new RegExp(`### ${heading}\\n\\n([\\s\\S]*?)(?:\\n###|\\n$|$)`);
            const m = body.match(re);
            return m ? m[1].trim() : undefined;
          };
          const nodeResult = await this.adapter.runCommand("gh", [
            "issue",
            "view",
            itemId,
            "--json",
            "id",
            ...this.adapter.buildRepoArg(),
          ]);
          if (nodeResult.code === 0) {
            const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
            let projectItemNodeId: string;
            const { PbiEffortAnalysisData } = await import("./pbi-effort-analysis-data.ts");
            try {
              ({ projectItemNodeId } = await this.adapter.addItemToProject(
                nodeData.id,
                this.adapter.productBacklogBoardNumber,
              ));
            } catch {
              const owned = this.adapter.scopeOwner;
              const repod = this.adapter.scopeRepository;
              if (!owned || !repod) return { operation: "recordAnalysis", success: true, itemId };
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
              if (lr.code !== 0) return { operation: "recordAnalysis", success: true, itemId };
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
                n.project.number === this.adapter.productBacklogBoardNumber!
              );
              if (!matched) return { operation: "recordAnalysis", success: true, itemId };
              projectItemNodeId = matched.id;
            }
            const text = await this.adapter.readTextFieldValue(
              projectItemNodeId,
              this.adapter.productBacklogBoardNumber,
              "harness-efforts-analysis",
            );
            const data = PbiEffortAnalysisData.fromJson(text ?? "");
            data.setAnalysisFields(
              extract("Planning Review"),
              extract("Execution Review"),
              extract("Improvement Suggestions"),
            );
            await this.adapter.setTextFieldValue(
              projectItemNodeId,
              this.adapter.productBacklogBoardNumber,
              "harness-efforts-analysis",
              data.toJson(),
            );
          }
        } catch { /* ok */ }
      }
      return { operation: "recordAnalysis", success: true, itemId };
    });

    handlers.set("defineAcceptanceCriteria", async (_op, params) => {
      const title = String(params.title ?? "");
      const parentPbi = String(params.parentPbi ?? "");
      if (!title || !parentPbi) {
        return {
          operation: "defineAcceptanceCriteria",
          success: false,
          error: "title and parentPbi are required",
        };
      }
      const cr = await this.adapter.handleCreateItem({ title, body: params.body, type: "WP" });
      if (!cr.success || !cr.itemId) return cr;
      const pr = await this.adapter.handleSetParent(cr.itemId, parentPbi);
      if (!pr.success) return pr;
      return cr;
    });

    handlers.set("comment", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      const body = String(params.body ?? "");
      if (!itemId || !body) {
        return { operation: "comment", success: false, error: "itemId and body are required" };
      }
      try {
        const viewResult = await this.adapter.runCommand("gh", [
          "issue",
          "view",
          itemId,
          "--json",
          "comments",
          ...this.adapter.buildRepoArg(),
        ]);
        if (viewResult.code === 0) {
          const viewData = JSON.parse(viewResult.stdout) as {
            comments: Array<{ id: string; body: string }>;
          };
          const existing = viewData.comments.find((c) => c.body.startsWith("## History"));
          if (existing) {
            const lines = existing.body.split("\n");
            const existingRows = lines.filter((l) => /^\|\s*\d+\s*\|/.test(l));
            const nextNum = existingRows.length + 1;
            const newRow = body.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l))[0];
            if (newRow) {
              const updatedRow = newRow.replace(/^\|\s*\d+\s*\|/, `| ${nextNum} |`);
              const gqlBody = JSON.stringify({
                query:
                  `mutation($id: ID!, $body: String!) { updateIssueComment(input: {id: $id, body: $body}) { issueComment { id } } }`,
                variables: { id: existing.id, body: existing.body + "\n" + updatedRow },
              });
              const tmpFile = `/tmp/opencode/gh_cmt_${Date.now()}.json`;
              await Deno.writeTextFile(tmpFile, gqlBody);
              const gr = await this.adapter.runCommand("gh", [
                "api",
                "graphql",
                "--input",
                tmpFile,
              ]);
              try {
                await Deno.remove(tmpFile);
              } catch { /* ok */ }
              if (gr.code === 0) {
                const grData = JSON.parse(gr.stdout);
                if (!grData.errors) return { operation: "comment", success: true, itemId };
              }
            }
          }
        }
      } catch { /* fallthrough */ }
      return await this.adapter.handleAddComment(params);
    });

    handlers.set("view", async (_op, params) => {
      return await this.adapter.handleFindItem(params);
    });

    handlers.set("search", async (_op, params) => {
      if (params.status && this.adapter.productBacklogBoardNumber) {
        return await this.adapter.handleProjectSearchItems({
          ...params,
          labelType: "PBI",
          boardNumber: this.adapter.productBacklogBoardNumber,
        });
      }
      return await this.adapter.handleSearchItems({ ...params, labelType: "PBI" });
    });

    const existing = stepHandlers.get("ProductBacklogItem") ?? new Map();
    for (const [op, handler] of handlers) existing.set(op, handler);
    stepHandlers.set("ProductBacklogItem", existing);
  }
}
