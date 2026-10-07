import { assert, assertEquals, assertRejects } from "@std/assert";
import type { ExecuteResult } from "./io/command.ts";
import {
  detectCurrentSprint,
  parseScopeFromRemote,
  resolveScope,
  type SprintCommandRunner,
} from "./sprint-utils.ts";
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

function originRunner(
  opts: { cwdOk: boolean; repoDirOk: boolean; url: string },
): { runner: SprintCommandRunner; calls: { cmd: string; args: string[] }[] } {
  const calls: { cmd: string; args: string[] }[] = [];
  const runner: SprintCommandRunner = (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd !== "git") return Promise.resolve({ code: 1, stdout: "", stderr: "" });
    const isDir = args[0] === "-C";
    const good = isDir ? opts.repoDirOk : opts.cwdOk;
    return Promise.resolve(
      good
        ? { code: 0, stdout: opts.url, stderr: "" }
        : { code: 128, stdout: "", stderr: "fatal: not a git repository" },
    );
  };
  return { runner, calls };
}

Deno.test("resolveScope - cwd失敗→repoDir基準 git -C で解決する（WP#806 AC-2）", async () => {
  const { runner, calls } = originRunner({
    cwdOk: false,
    repoDirOk: true,
    url: "git@github.com-alias:my-org/my-repo.git\n",
  });
  const scope = await resolveScope(UNKNOWN_SCOPE, runner, () => "/ws/my-repo");
  assertEquals(scope, { owner: "my-org", repository: "my-repo" });
  assert(calls.some((c) => c.cmd === "git" && c.args.slice(0, 2).join(" ") === "-C /ws/my-repo"));
});

Deno.test("resolveScope - cwd が git repo なら repoDir を使わない（WP#806 M4・multi-repo安全）", async () => {
  const { runner, calls } = originRunner({
    cwdOk: true,
    repoDirOk: true,
    url: "git@github.com:real-org/real-repo.git\n",
  });
  const scope = await resolveScope(UNKNOWN_SCOPE, runner, () => "/stale/other");
  assertEquals(scope, { owner: "real-org", repository: "real-repo" });
  assertEquals(calls.some((c) => c.cmd === "git" && c.args[0] === "-C"), false);
});

Deno.test("resolveScope - remote解析不能なら reject（WP#806 M6）", async () => {
  const { runner } = originRunner({ cwdOk: true, repoDirOk: false, url: "not-a-remote-url\n" });
  await assertRejects(
    () => resolveScope(UNKNOWN_SCOPE, runner, () => null),
    Error,
    "Could not parse owner/repo",
  );
});

Deno.test("resolveScope - cwd と repoDir 双方失敗なら reject（WP#806 M1/M6）", async () => {
  const { runner } = originRunner({ cwdOk: false, repoDirOk: false, url: "" });
  await assertRejects(
    () => resolveScope(UNKNOWN_SCOPE, runner, () => "/ws/missing"),
    Error,
    "Failed to resolve scope",
  );
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
