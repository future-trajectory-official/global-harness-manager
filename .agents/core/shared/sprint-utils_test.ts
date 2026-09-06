import { assertEquals } from "@std/assert";
import type { ExecuteResult } from "./io/command.ts";
import { detectCurrentSprint, parseScopeFromRemote, resolveScope } from "./sprint-utils.ts";
import { UNKNOWN_SCOPE } from "../domain/types.ts";

function ok(stdout: string): ExecuteResult {
  return { code: 0, stdout, stderr: "" };
}

const MILESTONE_JSON = JSON.stringify({ number: 30, title: "Sprint 21", node_id: "MDk:MS_30" });

function scriptedRunner(responses: Record<string, ExecuteResult>) {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const result = responses[cmd];
    return Promise.resolve(result ?? { code: 1, stdout: "", stderr: `unexpected: ${cmd}` });
  };
  return { runner, calls };
}

Deno.test("parseScopeFromRemote - sshエイリアス形式からowner/repoを解釈できる", () => {
  const scope = parseScopeFromRemote("git@github.com-alias:my-org/my-repo.git");
  assertEquals(scope, { owner: "my-org", repository: "my-repo" });
});

Deno.test("parseScopeFromRemote - 標準ssh形式を解釈できる", () => {
  const scope = parseScopeFromRemote("git@github.com:my-org/my-repo.git");
  assertEquals(scope, { owner: "my-org", repository: "my-repo" });
});

Deno.test("parseScopeFromRemote - https形式を解釈できる", () => {
  const scope = parseScopeFromRemote("https://github.com/my-org/my-repo.git");
  assertEquals(scope, { owner: "my-org", repository: "my-repo" });
});

Deno.test("parseScopeFromRemote - 解釈不能ならnull", () => {
  assertEquals(parseScopeFromRemote("garbage-url"), null);
});

Deno.test("resolveScope - 明示scopeはそのまま返す（コマンド実行しない）", async () => {
  const { runner, calls } = scriptedRunner({});
  const scope = await resolveScope({ owner: "my-org", repository: "my-repo" }, runner);
  assertEquals(scope, { owner: "my-org", repository: "my-repo" });
  assertEquals(calls.length, 0);
});

Deno.test("resolveScope - unknownプレースホルダはgit remoteから自動解決する", async () => {
  const { runner, calls } = scriptedRunner({
    git: ok("git@github.com-alias:my-org/my-repo.git\n"),
  });
  const scope = await resolveScope(UNKNOWN_SCOPE, runner);
  assertEquals(scope, { owner: "my-org", repository: "my-repo" });
  assertEquals(calls[0]?.cmd, "git");
});

Deno.test("resolveScope - remote解析不能ならエラー", async () => {
  const { runner } = scriptedRunner({ git: ok("not-a-remote-url") });
  await resolveScope(UNKNOWN_SCOPE, runner).catch((e: Error) => {
    assertEquals(e.message.includes("Could not parse owner/repo"), true);
  });
});

Deno.test("detectCurrentSprint - scope未指定でもremote解決したowner/repoでmilestoneを検索する", async () => {
  const { runner, calls } = scriptedRunner({
    git: ok("git@github.com-alias:my-org/my-repo.git\n"),
    gh: ok(MILESTONE_JSON),
  });
  const identifier = await detectCurrentSprint(UNKNOWN_SCOPE, runner);
  assertEquals(identifier.scope.owner, "my-org");
  assertEquals(identifier.scope.repository, "my-repo");
  assertEquals(identifier.title.value, "Sprint 21");
  assertEquals(identifier.code, "30");
  const ghCall = calls.find((c) => c.cmd === "gh");
  assertEquals(
    ghCall?.args[1],
    "repos/my-org/my-repo/milestones?state=open&sort=number&direction=desc&per_page=1",
  );
});

Deno.test("detectCurrentSprint - 明示scope指定時はgit remoteを参照しない", async () => {
  const { runner, calls } = scriptedRunner({ gh: ok(MILESTONE_JSON) });
  await detectCurrentSprint({ owner: "my-org", repository: "my-repo" }, runner);
  assertEquals(calls.filter((c) => c.cmd === "git").length, 0);
  assertEquals(calls.filter((c) => c.cmd === "gh").length, 1);
});
