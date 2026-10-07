/**
 * scope-repo-dir モジュールのテスト（WP #806）。
 *
 * 非git cwd で `git -C` の基準ディレクトリを per-repo で解決する規則を検証する。
 * env・`.harnessrc` パス解決は依存注入し、実ファイルI/O・グローバル env に依存させない。
 */
import { assert, assertEquals } from "@std/assert";
import { readOriginRemoteUrl, resolveRepoDir } from "./scope-repo-dir.ts";
import type { ExecuteResult } from "./io/command.ts";

/**
 * ユースケース: HARNESS_WORKSPACE_ROOT が最優先で返ること
 * 検証意図: workspace root 指定時は .harnessrc を見ず当該 dir を返すことを確認する
 */
Deno.test("resolveRepoDir - HARNESS_WORKSPACE_ROOT 優先", () => {
  const dir = resolveRepoDir({
    env: (k) => (k === "HARNESS_WORKSPACE_ROOT" ? "/ws/repo" : undefined),
    harnessRcPath: () => "/elsewhere/.harnessrc",
  });
  assertEquals(dir, "/ws/repo");
});

/**
 * ユースケース: workspace root 不在時は .harnessrc の所在ディレクトリを返すこと
 * 検証意図: env 未設定で .harnessrc が解決できればその dirname を返すことを確認する（per-repo）
 */
Deno.test("resolveRepoDir - .harnessrc の dirname を利用", () => {
  const dir = resolveRepoDir({
    env: () => undefined,
    harnessRcPath: () => "/repo/.harnessrc",
  });
  assertEquals(dir, "/repo");
});

/**
 * ユースケース: どちらも決定不能なら null（ambient cwd フォールバックへ委ねる）こと
 * 検証意図: env・.harnessrc とも不在なら null を返し呼び出し元が従来動作へ落ちることを確認する
 */
Deno.test("resolveRepoDir - 決定不能時は null", () => {
  const dir = resolveRepoDir({
    env: () => undefined,
    harnessRcPath: () => null,
  });
  assertEquals(dir, null);
});

function gitRunner(
  opts: { cwdOk: boolean; repoDirOk: boolean; url: string },
): {
  run: (c: string, a: string[]) => Promise<ExecuteResult>;
  calls: { cmd: string; args: string[] }[];
} {
  const calls: { cmd: string; args: string[] }[] = [];
  const run = (cmd: string, args: string[]): Promise<ExecuteResult> => {
    calls.push({ cmd, args });
    const isDir = args[0] === "-C";
    const good = isDir ? opts.repoDirOk : opts.cwdOk;
    return Promise.resolve(
      good
        ? { code: 0, stdout: opts.url, stderr: "" }
        : { code: 128, stdout: "", stderr: "fatal: not a git repository" },
    );
  };
  return { run, calls };
}

/**
 * ユースケース: cwd が git repo なら cwd の remote を返すこと
 * 検証意図: 素の `git remote get-url origin` が成功すれば repoDir を参照しないことを確認する（WP#806 M4）
 */
Deno.test("readOriginRemoteUrl - cwd 成功時は repoDir を引かない", async () => {
  const { run, calls } = gitRunner({
    cwdOk: true,
    repoDirOk: true,
    url: "https://github.com/o/r.git",
  });
  const res = await readOriginRemoteUrl(run, () => "/other");
  assertEquals(res.ok, true);
  assertEquals(res.url, "https://github.com/o/r.git");
  assertEquals(calls.some((c) => c.args[0] === "-C"), false);
});

/**
 * ユースケース: 非git cwd では repoDir 基準で `-C` 再試行すること
 * 検証意図: cwd 失敗後に `git -C <repoDir> remote` で解決されることを確認する（WP#806 AC-2/M1）
 */
Deno.test("readOriginRemoteUrl - cwd 失敗→repoDir で解決", async () => {
  const { run, calls } = gitRunner({
    cwdOk: false,
    repoDirOk: true,
    url: "https://github.com/o/r.git",
  });
  const res = await readOriginRemoteUrl(run, () => "/ws/o");
  assertEquals(res.ok, true);
  assertEquals(res.url, "https://github.com/o/r.git");
  assert(calls.some((c) => c.args.slice(0, 2).join(" ") === "-C /ws/o"));
});

/**
 * ユースケース: 双方失敗時は失敗理由を返すこと
 * 検証意図: cwd と repoDir 双方失敗で ok:false と error を返すことを確認する（WP#806 M6）
 */
Deno.test("readOriginRemoteUrl - 双方失敗で ok:false", async () => {
  const { run } = gitRunner({ cwdOk: false, repoDirOk: false, url: "" });
  const res = await readOriginRemoteUrl(run, () => "/ws/missing");
  assertEquals(res.ok, false);
  assert(typeof res.error === "string" && res.error.length > 0);
});
