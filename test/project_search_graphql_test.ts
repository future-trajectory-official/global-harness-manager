import { assertEquals } from "@std/assert";
import { PlanGatewayAdapter } from "../.agents/core/gateway/plan-gateway-adapter.ts";

type ExecuteResult = { code: number; stdout: string; stderr: string };

/**
 * gh をモックする runCommand を構築する。
 * `gh api graphql`（projectV2.items）のみ応答し、他の呼出は失敗させる。
 */
function mockRunCommand(
  calls: string[][],
  opts: { items?: Array<{ number: number; title: string; status: string | null }> } = {},
) {
  const items = opts.items ?? [
    { number: 716, title: "OpenCode グローバル配置メカニズムの調査", status: "Todo" },
    { number: 717, title: "グローバルスキル時の参照解決方式の検討", status: "Todo" },
    { number: 718, title: ".agents と .opencode の統合構造の設計", status: "Todo" },
  ];
  return (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push([cmd, ...args]);
    if (cmd === "gh" && args[0] === "api" && args[1] === "graphql") {
      const response = {
        data: {
          organization: {
            projectV2: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: items.map((item) => ({
                  content: { number: item.number, title: item.title },
                  fieldValueByName: { name: item.status },
                })),
              },
            },
          },
        },
      };
      return Promise.resolve({ code: 0, stdout: JSON.stringify(response), stderr: "" });
    }
    return Promise.resolve({
      code: 1,
      stdout: "",
      stderr: `unexpected gh call: ${args.join(" ")}`,
    });
  };
}

/**
 * @description ボード項目のstatus+スプリントをサーバー側フィルタ（ProjectV2.items query DSL）で取得し、
 * 一致したWP（#716/#717/#718）を返すこと
 * @verify success=true / 3件 / #718が含まれる / GraphQLフィルタにstatus・milestoneが渡ること
 */
Deno.test("handleProjectSearchItems - status+sprint server-side filter returns matching WPs", async () => {
  const calls: string[][] = [];
  const adapter = new PlanGatewayAdapter(mockRunCommand(calls));
  adapter.setScope("future-trajectory-official", "global-harness-manager");
  adapter.setProjectBoardNumbers(10, 11, 12);

  const result = await adapter.handleProjectSearchItems({
    status: "Todo",
    labelType: "WP",
    boardNumber: 11,
    sprintNumber: 22,
  });
  assertEquals(result.success, true);

  const output = (result as { output: Array<{ number: number; title: string }> }).output;
  assertEquals(output.map((o) => o.number).sort(), [716, 717, 718]);

  const graphqlCall = calls.find((c) => c[0] === "gh" && c[1] === "api" && c[2] === "graphql");
  assertEquals(graphqlCall !== undefined, true);
  const filterArg = graphqlCall!.find((a) => a.startsWith("filter="));
  assertEquals(filterArg, 'filter=status:"Todo" milestone:"Sprint 22"');
});

/**
 * @description 30件を超えるボードでもページネーション（hasNextPage→endCursor）で全件を取得し、
 * 対象WPを漏れなく返すこと（#718は2ページ目で取得）
 * @verify success=true / 3件 / 2回GraphQLクエリが発行される
 */
Deno.test("handleProjectSearchItems - paginates to fetch items beyond first page", async () => {
  const calls: string[][] = [];
  const items = [
    { number: 700, title: "WP-1", status: "Todo" },
    { number: 701, title: "WP-2", status: "Todo" },
    { number: 718, title: ".agents と .opencode の統合構造の設計", status: "Todo" },
  ];
  const adapter = new PlanGatewayAdapter((cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === "gh" && args[0] === "api" && args[1] === "graphql") {
      const hasCursor = args.some((a) => a.startsWith("cursor="));
      const page1 = hasCursor ? [] : items.slice(0, 2);
      const page2 = hasCursor ? items.slice(2) : [];
      const response = {
        data: {
          organization: {
            projectV2: {
              items: {
                pageInfo: {
                  hasNextPage: !hasCursor,
                  endCursor: !hasCursor ? "page2" : null,
                },
                nodes: [...page1, ...page2].map((item) => ({
                  content: { number: item.number, title: item.title },
                  fieldValueByName: { name: item.status },
                })),
              },
            },
          },
        },
      };
      return Promise.resolve({ code: 0, stdout: JSON.stringify(response), stderr: "" });
    }
    return Promise.resolve({
      code: 1,
      stdout: "",
      stderr: `unexpected gh call: ${args.join(" ")}`,
    });
  });
  adapter.setScope("future-trajectory-official", "global-harness-manager");
  adapter.setProjectBoardNumbers(10, 11, 12);

  const result = await adapter.handleProjectSearchItems({
    status: "Todo",
    labelType: "WP",
    boardNumber: 11,
  });
  assertEquals(result.success, true);
  const output = (result as { output: Array<{ number: number; title: string }> }).output;
  assertEquals(output.map((o) => o.number).sort(), [700, 701, 718]);

  const graphqlCalls = calls.filter((c) => c[0] === "gh" && c[1] === "api" && c[2] === "graphql");
  assertEquals(graphqlCalls.length, 2);
});

/**
 * @description `__none__`（status未設定）はクエリDSLで表現できないため取得後にローカルで判定し、
 * statusがnullの項目のみ返すこと
 * @verify success=true / status=nullの項目のみ返る
 */
Deno.test("handleProjectSearchItems - __none__ status filters null status locally", async () => {
  const calls: string[][] = [];
  const items = [
    { number: 716, title: "WP-A", status: "Todo" },
    { number: 719, title: "WP-B", status: null },
  ];
  const adapter = new PlanGatewayAdapter(mockRunCommand(calls, { items }));
  adapter.setScope("future-trajectory-official", "global-harness-manager");
  adapter.setProjectBoardNumbers(10, 11, 12);

  const result = await adapter.handleProjectSearchItems({
    status: "__none__",
    labelType: "WP",
    boardNumber: 11,
  });
  assertEquals(result.success, true);
  const output = (result as { output: Array<{ number: number; title: string }> }).output;
  assertEquals(output.map((o) => o.number), [719]);

  const filterArg = calls
    .find((c) => c[0] === "gh" && c[1] === "api" && c[2] === "graphql")!
    .find((a) => a.startsWith("filter="));
  assertEquals(filterArg, "filter=");
});
