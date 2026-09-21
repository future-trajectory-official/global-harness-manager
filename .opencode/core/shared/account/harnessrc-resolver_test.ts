import { assertEquals } from "@std/assert";
import {
  buildHarnessRcCandidates,
  findFirstExisting,
  resolveHarnessRcPath,
} from "./harnessrc-resolver.ts";

Deno.test("buildHarnessRcCandidates: envPath が最優先になる", () => {
  const candidates = buildHarnessRcCandidates({
    envPath: "/repo/.harnessrc",
    workspaceRoot: "/repo",
    cwd: "/cwd",
  });
  assertEquals(candidates[0], "/repo/.harnessrc");
});

Deno.test("buildHarnessRcCandidates: workspaceRoot 候補が cwd 候補より先", () => {
  const candidates = buildHarnessRcCandidates({
    workspaceRoot: "/repo",
    cwd: "/cwd",
  });
  const idxRepoRoot = candidates.indexOf("/repo/.harnessrc");
  const idxCwdRoot = candidates.indexOf("/cwd/.harnessrc");
  assertEquals(idxRepoRoot < idxCwdRoot, true);
});

Deno.test("buildHarnessRcCandidates: 重複が除去され順序保持される", () => {
  const candidates = buildHarnessRcCandidates({
    workspaceRoot: "/repo",
    cwd: "/repo",
  });
  const set = new Set(candidates);
  assertEquals(set.size, candidates.length);
});

Deno.test("findFirstExisting: 最初に存在する候補を返す", () => {
  const exists = (p: string) => p === "/repo/.github/schemas/.harnessrc";
  const result = findFirstExisting(
    ["/repo/.harnessrc", "/repo/.github/schemas/.harnessrc"],
    exists,
  );
  assertEquals(result, "/repo/.github/schemas/.harnessrc");
});

Deno.test("findFirstExisting: 全候補不在なら null", () => {
  const result = findFirstExisting(["/x", "/y"], () => false);
  assertEquals(result, null);
});

Deno.test("resolveHarnessRcPath: 環境変数 HARNESS_RC_PATH が優先される", () => {
  const result = resolveHarnessRcPath({
    env: (key) => (key === "HARNESS_RC_PATH" ? "/env/.harnessrc" : undefined),
    cwd: () => "/cwd",
    workspaceRoot: () => "/repo",
    exists: (p) => p === "/env/.harnessrc",
  });
  assertEquals(result, "/env/.harnessrc");
});

Deno.test("resolveHarnessRcPath: 全候補不在なら null", () => {
  const result = resolveHarnessRcPath({
    env: () => undefined,
    cwd: () => "/cwd",
    workspaceRoot: () => undefined,
    exists: () => false,
  });
  assertEquals(result, null);
});

Deno.test("resolveHarnessRcPath: リポジトリルート直下 .harnessrc を解決", () => {
  const result = resolveHarnessRcPath({
    env: () => undefined,
    cwd: () => "/cwd",
    workspaceRoot: () => "/repo",
    exists: (p) => p === "/repo/.harnessrc",
  });
  assertEquals(result, "/repo/.harnessrc");
});
