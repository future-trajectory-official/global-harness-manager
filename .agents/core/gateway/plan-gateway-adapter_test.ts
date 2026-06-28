import { assertEquals, assertStringIncludes } from "@std/assert";
import type { ExecuteResult } from "../shared/io/command.ts";
import { PlanGatewayAdapter } from "./plan-gateway-adapter.ts";
import type { Plan, Step } from "../domain/types.ts";

function mockRunner() {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  return { runner, calls };
}

function fixedRunner(stdout: string) {
  return (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    return Promise.resolve({ code: 0, stdout, stderr: "" });
  };
}

const OWNER = "my-org";
const REPO = "my-repo";

function makeAdapter(
  runner: ReturnType<typeof mockRunner>["runner"] = mockRunner().runner,
): PlanGatewayAdapter {
  return new PlanGatewayAdapter(OWNER, REPO, runner);
}

/**
 * PlanGateway - execute が空の Plan.steps に対して空の ExecutionResult を返すことを検証する。
 * AC6: steps が空の場合、stepResults: [] を返しエラーにしない。
 */
Deno.test("PlanGateway - should return empty stepResults for empty plan steps", async () => {
  const adapter = makeAdapter();
  const plan: Plan = { summary: "empty", steps: [] };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults, []);
});

/**
 * PlanGateway - 未知の operation が success=false を返すことを検証する。
 * AC4: 未定義の operation は StepResult.success = false で error に operation 名を格納する。
 */
Deno.test("PlanGateway - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown op",
    steps: [{ operation: "unknownOp" as never, params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].error, "Unknown operation: unknownOp");
});

/**
 * PlanGateway - createItem で title, body, type が正しく gh CLI 引数にマッピングされることを検証する。
 * AC1: title → --title, body → --body, type → --label type:<値>, scope → --repo
 */
Deno.test("createItem - should map full params to gh issue create args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const step: Step = {
    operation: "createItem",
    params: { title: "Test Vision", body: "body text", type: "Vision" },
  };
  await adapter.execute({ summary: "test", steps: [step] });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "create");
  assertStringIncludes(calls[0].args.join(" "), "--title Test Vision");
  assertStringIncludes(calls[0].args.join(" "), "--body body text");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Vision");
  assertStringIncludes(calls[0].args.join(" "), `--repo ${OWNER}/${REPO}`);
});

/**
 * PlanGateway - createItem で空の title/body が空文字のまま渡されることを検証する。
 * AC5: 空文字の title/body は空文字のまま gh CLI に渡す。
 */
Deno.test("createItem - should pass empty title and body as empty strings", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const step: Step = {
    operation: "createItem",
    params: { title: "", body: "", type: "PBI" },
  };
  await adapter.execute({ summary: "test", steps: [step] });
  assertEquals(calls.length, 1);
  assertStringIncludes(calls[0].args.join(" "), "--title ");
  assertStringIncludes(calls[0].args.join(" "), "--body ");
});

/**
 * PlanGateway - findItem で itemId が正しく gh issue view 引数にマッピングされ、
 * 出力が正しくパースされることを検証する。
 * AC2: itemId → 位置引数, --json に title/body/labels を含む。
 */
Deno.test("findItem - should map itemId to gh issue view args", async () => {
  const expectedOutput = JSON.stringify({
    number: 42,
    title: "Found Vision",
    body: "body",
    labels: [{ name: "type:Vision" }],
    id: "node-abc",
  });
  const findAdapter = makeAdapter(fixedRunner(expectedOutput));
  const step: Step = {
    operation: "findItem",
    params: { itemId: "42" },
  };
  const result = await findAdapter.execute({ summary: "test", steps: [step] });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * PlanGateway - findItem が itemId なしでエラーを返すことを検証する。
 */
Deno.test("findItem - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const step: Step = {
    operation: "findItem",
    params: {},
  };
  const result = await adapter.execute({ summary: "test", steps: [step] });
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * PlanGateway - addComment で itemId と body が正しく gh issue comment 引数にマッピングされることを検証する。
 * AC3: itemId → 位置引数, body → --body。
 */
Deno.test("addComment - should map itemId and body to gh issue comment args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const step: Step = {
    operation: "addComment",
    params: { itemId: "42", body: "comment text" },
  };
  await adapter.execute({ summary: "test", steps: [step] });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

/**
 * PlanGateway - addComment で createItem の結果から itemId が継承されることを検証する。
 * Step 連鎖: createItem で生成された itemId が addComment で暗黙的に使用される。
 */
Deno.test("addComment - should inherit itemId from previous createItem step", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: `https://github.com/${OWNER}/${REPO}/issues/99`,
        stderr: "",
      });
    }
    if (callCount === 2) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-99" }), stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "create then comment",
    steps: [
      { operation: "createItem", params: { title: "V", body: "b", type: "Vision" } },
      { operation: "addComment", params: { body: "comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "99");
  assertEquals(result.stepResults[1].success, true);
  assertEquals(result.stepResults[1].itemId, "99");
});

/**
 * PlanGateway - addComment がコンテキストなしでエラーを返すことを検証する。
 * itemId も lastItemId もない場合、エラーメッセージを返す。
 */
Deno.test("addComment - should fail without any context", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const step: Step = {
    operation: "addComment",
    params: { body: "orphan comment" },
  };
  const result = await adapter.execute({ summary: "test", steps: [step] });
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No target issue specified");
});

/**
 * PlanGateway - searchItems で type が正しく gh issue list 引数にマッピングされ、
 * パースされた結果が返ることを検証する。
 * AC8-ext: type → --label type:<値>, --json に number,title,labels を含む。
 */
Deno.test("searchItems - should map type to gh issue list args", async () => {
  const expectedOutput = JSON.stringify([
    { number: 42, title: "Existing Vision", labels: [{ name: "type:Vision" }] },
  ]);
  const searchAdapter = makeAdapter(fixedRunner(expectedOutput));
  const step: Step = {
    operation: "searchItems",
    params: { type: "Vision" },
  };
  const result = await searchAdapter.execute({ summary: "test", steps: [step] });
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

/**
 * PlanGateway - searchItems が type なしでエラーを返すことを検証する。
 */
Deno.test("searchItems - should fail without type", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const step: Step = {
    operation: "searchItems",
    params: {},
  };
  const result = await adapter.execute({ summary: "test", steps: [step] });
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "type is required");
});
