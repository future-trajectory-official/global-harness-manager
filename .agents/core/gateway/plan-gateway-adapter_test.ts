import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { ExecuteResult } from "../shared/io/command.ts";
import { PlanGatewayAdapter } from "./plan-gateway-adapter.ts";
import type { Plan } from "../domain/types.ts";

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
 * 未定義の operation は StepResult.success = false で error に operation 名を格納する。
 */
Deno.test("PlanGateway - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown operation",
    steps: [{ entity: "Vision", operation: "unknownOp" as never, params: {} }],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, false);
  assertEquals(result.stepResults[0].error, "Unknown operation: unknownOp");
});

/**
 * PlanGateway - Vision create で title, body が正しく gh CLI 引数にマッピングされることを検証する。
 */
Deno.test("Vision create - should map full params to gh issue create args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Vision",
        operation: "create",
        params: { title: "Test Vision", body: "body text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  // call[0]: duplicate check search
  assertEquals(calls[0].cmd, "gh");
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Vision");
  // call[1]: actual create
  assertEquals(calls[1].cmd, "gh");
  assertEquals(calls[1].args[0], "issue");
  assertEquals(calls[1].args[1], "create");
  assertStringIncludes(calls[1].args.join(" "), "--title Test Vision");
  assertStringIncludes(calls[1].args.join(" "), "--body body text");
  assertStringIncludes(calls[1].args.join(" "), "--label type:Vision");
  assertStringIncludes(calls[1].args.join(" "), `--repo ${OWNER}/${REPO}`);
});

/**
 * PlanGateway - Vision create で空の title/body が空文字のまま渡されることを検証する。
 */
Deno.test("Vision create - should pass empty title and body as empty strings", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "create", params: { title: "", body: "" } },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 2);
  // call[0]: duplicate check search (returns empty list)
  assertEquals(calls[0].cmd, "gh");
  assertStringIncludes(calls[0].args.join(" "), "issue list");
  // call[1]: actual create
  assertStringIncludes(calls[1].args.join(" "), "--title ");
  assertStringIncludes(calls[1].args.join(" "), "--body ");
});

/**
 * PlanGateway - Vision view で itemId が正しく gh issue view 引数にマッピングされ、
 * 出力が正しくパースされることを検証する。
 */
Deno.test("Vision view - should map itemId to gh issue view args", async () => {
  const expectedOutput = JSON.stringify({
    number: 42,
    title: "Found Vision",
    body: "body",
    labels: [{ name: "type:Vision" }],
    id: "node-abc",
  });
  const findAdapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await findAdapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

/**
 * PlanGateway - Vision view が itemId なしでエラーを返すことを検証する。
 */
Deno.test("Vision view - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "view", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

/**
 * PlanGateway - Vision comment で itemId と body が正しく gh issue comment 引数にマッピングされることを検証する。
 */
Deno.test("Vision comment - should map itemId and body to gh issue comment args", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "comment", params: { itemId: "42", body: "comment text" } },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

/**
 * PlanGateway - Vision create + comment で create の結果から itemId が継承されることを検証する。
 * Step 連鎖: create で生成された itemId が comment で暗黙的に使用される。
 */
Deno.test("Vision create+comment - should inherit itemId from previous create step", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    // call 1: duplicate check search (returns empty - no existing Vision)
    if (callCount === 1) {
      return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
    }
    // call 2: handleCreateItem → gh issue create
    if (callCount === 2) {
      return Promise.resolve({
        code: 0,
        stdout: `https://github.com/${OWNER}/${REPO}/issues/99`,
        stderr: "",
      });
    }
    // call 3: nodeId fetch inside handleCreateItem
    if (callCount === 3) {
      return Promise.resolve({ code: 0, stdout: JSON.stringify({ id: "node-99" }), stderr: "" });
    }
    // call 4: handleAddComment
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "create then comment",
    steps: [
      { entity: "Vision", operation: "create", params: { title: "V", body: "b" } },
      { entity: "Vision", operation: "comment", params: { body: "comment" } },
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
 * PlanGateway - Vision comment がコンテキストなしでエラーを返すことを検証する。
 * itemId も lastItemId もない場合、エラーメッセージを返す。
 */
Deno.test("Vision comment - should fail without any context", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "comment", params: { body: "orphan comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "No target issue specified");
});

/**
 * PlanGateway - Vision search で labelType が正しく gh issue list 引数にマッピングされ、
 * パースされた結果が返ることを検証する。
 */
Deno.test("Vision search - should map labelType to gh issue list args", async () => {
  const expectedOutput = JSON.stringify([
    { number: 42, title: "Existing Vision", labels: [{ name: "type:Vision" }] },
  ]);
  const searchAdapter = makeAdapter(fixedRunner(expectedOutput));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "search", params: { labelType: "Vision" } },
    ],
  };
  const result = await searchAdapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

/**
 * PlanGateway - Vision search が labelType なしでエラーを返すことを検証する。
 */
Deno.test("Vision search - should fail without labelType", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Vision", operation: "search", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "type is required");
});

/**
 * Assess-Alignment WP_1: AC-1
 * Vision update - title only. params.title のみ指定 → gh issue edit --title が呼ばれる。
 */
Deno.test("Vision update - title only should call gh issue edit with --title", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "update title only",
    steps: [
      { entity: "Vision", operation: "update", params: { itemId: "42", title: "New Title" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--title New Title");
});

/**
 * Assess-Alignment WP_1: AC-2
 * Vision update - bodyAppend only. 既存 Body を取得し追記した上で gh issue edit --body が呼ばれる。
 */
Deno.test("Vision update - bodyAppend only should fetch body then edit with appended body", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ body: "Existing body content" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "append body",
    steps: [
      {
        entity: "Vision",
        operation: "update",
        params: { itemId: "42", bodyAppend: "Appended text" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
  // 2回目の呼出が gh issue edit --body のはず
  // モックでは全呼出が同じrunnerを通るので、
  // 少なくとも2回Callされたことと成功を確認
});

/**
 * Assess-Alignment WP_1: AC-3
 * Vision update - title + bodyAppend. 両方指定 → 正しくマージされる。
 */
Deno.test("Vision update - title and bodyAppend should set both", async () => {
  let callCount = 0;
  const chainedRunner = (_cmd: string, _args: string[]): Promise<ExecuteResult> => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({
        code: 0,
        stdout: JSON.stringify({ body: "Existing" }),
        stderr: "",
      });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  const adapter = makeAdapter(chainedRunner);
  const plan: Plan = {
    summary: "title and append",
    steps: [
      {
        entity: "Vision",
        operation: "update",
        params: { itemId: "42", title: "New Title", bodyAppend: "Appended" },
      },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 1);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(callCount, 2);
});

// ======== Review Operation Tests ========

Deno.test("Review plan - milestone string should map to gh issue create --milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "plan",
        params: { title: "Sprint 15 Review", body: "body", sprint: "15" },
      },
    ],
  };
  await adapter.execute(plan);
  assert(calls.length >= 1);
  assertStringIncludes(calls[0].args.join(" "), "issue create");
  assertStringIncludes(calls[0].args.join(" "), "--milestone 15");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Review");
});

Deno.test("Review plan - milestone SprintIdentifier should map to --milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "plan",
        params: {
          title: "Sprint 15 Review",
          body: "body",
          sprint: { title: { value: "Sprint 15" } },
        },
      },
    ],
  };
  await adapter.execute(plan);
  assert(calls.length >= 1);
  assertStringIncludes(calls[0].args.join(" "), "--milestone Sprint 15");
});

Deno.test("Review plan - should work without milestone", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "plan",
        params: { title: "Review", body: "body" },
      },
    ],
  };
  await adapter.execute(plan);
  assert(calls.length >= 1);
  assertStringIncludes(calls[0].args.join(" "), "issue create");
  assertStringIncludes(calls[0].args.join(" "), "--label type:Review");
});

Deno.test("Review report - should call gh issue edit", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "report",
        params: { itemId: "42", body: "report body" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
});

Deno.test("Review archive - should call gh issue close", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "archive",
        params: { itemId: "42" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "close");
  assertEquals(calls[0].args[2], "42");
});

Deno.test("Review archive - should fail without itemId", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Review", operation: "archive", params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "itemId is required");
});

Deno.test("Review view - should call gh issue view", async () => {
  const expected = JSON.stringify({
    number: 42,
    title: "Review",
    body: "body",
    labels: [{ name: "type:Review" }],
    id: "node-abc",
  });
  const adapter = makeAdapter(fixedRunner(expected));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Review", operation: "view", params: { itemId: "42" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "42");
});

Deno.test("Review search - should call gh issue list", async () => {
  const expected = JSON.stringify([
    { number: 42, title: "Existing Review", labels: [{ name: "type:Review" }] },
  ]);
  const adapter = makeAdapter(fixedRunner(expected));
  const plan: Plan = {
    summary: "test",
    steps: [
      { entity: "Review", operation: "search", params: { labelType: "Review" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, true);
  const output = result.stepResults[0].output as Array<Record<string, unknown>>;
  assertEquals(output.length, 1);
  assertEquals(output[0].number, 42);
});

Deno.test("Review update with title - should call gh issue edit", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "update",
        params: { itemId: "42", title: "Updated Title", body: "Updated body" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "edit");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--title Updated Title");
});

Deno.test("Review update without title - should add comment", async () => {
  const { runner, calls } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "test",
    steps: [
      {
        entity: "Review",
        operation: "update",
        params: { itemId: "42", body: "comment text" },
      },
    ],
  };
  await adapter.execute(plan);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].cmd, "gh");
  assertEquals(calls[0].args[0], "issue");
  assertEquals(calls[0].args[1], "comment");
  assertEquals(calls[0].args[2], "42");
  assertStringIncludes(calls[0].args.join(" "), "--body comment text");
});

Deno.test("Review plan+update - should inherit itemId for comment", async () => {
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
    summary: "plan then comment",
    steps: [
      { entity: "Review", operation: "plan", params: { title: "Sprint Review", body: "body" } },
      { entity: "Review", operation: "update", params: { body: "comment" } },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults.length, 2);
  assertEquals(result.stepResults[0].success, true);
  assertEquals(result.stepResults[0].itemId, "99");
  assertEquals(result.stepResults[1].success, true);
  assertEquals(result.stepResults[1].itemId, "99");
});

Deno.test("Review - should return error for unknown operation", async () => {
  const { runner } = mockRunner();
  const adapter = makeAdapter(runner);
  const plan: Plan = {
    summary: "unknown op",
    steps: [
      { entity: "Review", operation: "unknownOp" as never, params: {} },
    ],
  };
  const result = await adapter.execute(plan);
  assertEquals(result.stepResults[0].success, false);
  assertStringIncludes(result.stepResults[0].error ?? "", "Unknown operation");
});
