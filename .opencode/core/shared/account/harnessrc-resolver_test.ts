import { assertEquals } from "@std/assert";
import {
  buildHarnessRcCandidates,
  findFirstExisting,
  loadHarnessRcConfig,
  resolveHarnessRcPath,
} from "./harnessrc-resolver.ts";

/**
 * ユースケース: 明示指定が最優先で候補化されること
 * 検証意図: envPath が候補先頭になる
 */
Deno.test("buildHarnessRcCandidates: envPath が最優先になる", () => {
  const candidates = buildHarnessRcCandidates({
    envPath: "/repo/.harnessrc",
    workspaceRoot: "/repo",
    cwd: "/cwd",
  });
  assertEquals(candidates[0], "/repo/.harnessrc");
});

/**
 * ユースケース: リポジトリルート起点の候補が cwd 起点より優先されること
 * 検証意図: workspaceRoot 候補が cwd 候補より前に列挙される
 */
Deno.test("buildHarnessRcCandidates: workspaceRoot 候補が cwd 候補より先", () => {
  const candidates = buildHarnessRcCandidates({
    workspaceRoot: "/repo",
    cwd: "/cwd",
  });
  const idxRepoRoot = candidates.indexOf("/repo/.harnessrc");
  const idxCwdRoot = candidates.indexOf("/cwd/.harnessrc");
  assertEquals(idxRepoRoot < idxCwdRoot, true);
});

/**
 * ユースケース: 同一パスを重複探索しないこと
 * 検証意図: 重複除去後も優先順序が保持される
 */
Deno.test("buildHarnessRcCandidates: 重複が除去され順序保持される", () => {
  const candidates = buildHarnessRcCandidates({
    workspaceRoot: "/repo",
    cwd: "/repo",
  });
  const set = new Set(candidates);
  assertEquals(set.size, candidates.length);
});

/**
 * ユースケース: 優先順で最初の存在パスを選ぶこと
 * 検証意図: 存在する最初の候補が返る
 */
Deno.test("findFirstExisting: 最初に存在する候補を返す", () => {
  const exists = (p: string) => p === "/repo/.github/schemas/.harnessrc";
  const result = findFirstExisting(
    ["/repo/.harnessrc", "/repo/.github/schemas/.harnessrc"],
    exists,
  );
  assertEquals(result, "/repo/.github/schemas/.harnessrc");
});

/**
 * ユースケース: 存在パスが無い場合を除外すること
 * 検証意図: 全候補不在なら null になる
 */
Deno.test("findFirstExisting: 全候補不在なら null", () => {
  const result = findFirstExisting(["/x", "/y"], () => false);
  assertEquals(result, null);
});

/**
 * ユースケース: 明示指定パスを最優先で解決すること
 * 検証意図: HARNESS_RC_PATH の指定値が返る
 */
Deno.test("resolveHarnessRcPath: 環境変数 HARNESS_RC_PATH が優先される", () => {
  const result = resolveHarnessRcPath({
    env: (key) => (key === "HARNESS_RC_PATH" ? "/env/.harnessrc" : undefined),
    cwd: () => "/cwd",
    workspaceRoot: () => "/repo",
    exists: (p) => p === "/env/.harnessrc",
  });
  assertEquals(result, "/env/.harnessrc");
});

/**
 * ユースケース: 解決不能時を除外すること
 * 検証意図: 全候補不在なら null になる
 */
Deno.test("resolveHarnessRcPath: 全候補不在なら null", () => {
  const result = resolveHarnessRcPath({
    env: () => undefined,
    cwd: () => "/cwd",
    workspaceRoot: () => undefined,
    exists: () => false,
  });
  assertEquals(result, null);
});

/**
 * ユースケース: リポジトリルート直下の慣例パスを解決すること
 * 検証意図: workspaceRoot 直下 .harnessrc が返る
 */
Deno.test("resolveHarnessRcPath: リポジトリルート直下 .harnessrc を解決", () => {
  const result = resolveHarnessRcPath({
    env: () => undefined,
    cwd: () => "/cwd",
    workspaceRoot: () => "/repo",
    exists: (p) => p === "/repo/.harnessrc",
  });
  assertEquals(result, "/repo/.harnessrc");
});

/**
 * ユースケース: 明示パス配下の設定ファイルから設定切替情報を読めること
 * 検証意図: 有効な JSON から projects/fields が読み取れる
 */
Deno.test("loadHarnessRcConfig: 有効な設定を読める", () => {
  const config = loadHarnessRcConfig(
    "/env/.harnessrc",
    () => '{"projects":{"sprintBoard":11},"fields":{"harness-sequence":"harness-sequence"}}',
  );
  assertEquals(config, {
    projects: { sprintBoard: 11 },
    fields: { "harness-sequence": "harness-sequence" },
  });
});

/**
 * ユースケース: 対象外の明示パス指定を除外すること
 * 検証意図: パス null・読込失敗・不正 JSON は null になる
 */
Deno.test("loadHarnessRcConfig: 対象外は null を返す", () => {
  assertEquals(loadHarnessRcConfig(null, () => ""), null);
  assertEquals(
    loadHarnessRcConfig("/missing/.harnessrc", () => {
      throw new Error("not found");
    }),
    null,
  );
  assertEquals(loadHarnessRcConfig("/env/.harnessrc", () => "not-json{"), null);
});

/**
 * ユースケース: キー欠落の設定を空オブジェクトで補完すること
 * 検証意図: 旧挙動（欠落時は空）と互換になる
 */
Deno.test("loadHarnessRcConfig: キー欠落時は空オブジェクトになる", () => {
  assertEquals(loadHarnessRcConfig("/env/.harnessrc", () => "{}"), {
    projects: {},
    fields: {},
  });
  assertEquals(
    loadHarnessRcConfig("/env/.harnessrc", () => '{"projects":{"a":1}}'),
    { projects: { a: 1 }, fields: {} },
  );
});

/**
 * ユースケース: 型に合わない値を除外すること
 * 検証意図: 非数値ボード番号・非文字列フィールド・非オブジェクトは捨てられる
 */
Deno.test("loadHarnessRcConfig: 型外の値は除外される", () => {
  assertEquals(
    loadHarnessRcConfig(
      "/env/.harnessrc",
      () => '{"projects":{"ok":11,"ng":"x","inf":null},"fields":{"ok":"f","ng":5}}',
    ),
    { projects: { ok: 11 }, fields: { ok: "f" } },
  );
  assertEquals(
    loadHarnessRcConfig("/env/.harnessrc", () => '{"projects":[1],"fields":42}'),
    { projects: {}, fields: {} },
  );
});
