/**
 * verify_immutable_context_test.ts — maintain-context の不変ガードの検証
 *
 * AC2: maintain-context ガードが正本不在リポジトリで fatal にならず、
 *      グローバル参照へフォールバックすること。
 *
 * 方針:
 * - 「fatal を出さない」「exit 0 で返る」ことを CLI の実行結果で検証する。
 * - 追跡済みの正本が変更された場合は fail-closed（exit 1）であることも検証する。
 */

import { assert, assertEquals, assertMatch, assertNotMatch } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  type CommandResult,
  type CommandRunner,
  verifyImmutableContext,
} from "./verify_immutable_context.ts";

/** このテストファイルのディレクトリ（maintain-context/scripts） */
const SCRIPT_DIR = fromFileUrl(new URL(".", import.meta.url));

/** 解決スクリプトの絶対パス */
const SCRIPT_PATH = join(SCRIPT_DIR, "verify_immutable_context.ts");

/** maintain-context スキルのディレクトリ */
const SKILL_DIR = fromFileUrl(new URL("..", import.meta.url));

/** 編集規則リファレンス（§4 にガード手順を持つ） */
const EDITS_PATH = join(SKILL_DIR, "references", "edits.md");

/** スキル定義（実行手順4でガードに言及する） */
const SKILL_PATH = join(SKILL_DIR, "SKILL.md");

/** 不変正本のリポジトリ相対パス */
const MANAGEMENT_PATH = ".github/context/management.md";

/** 構造見本のリポジトリ相対パス */
const EXAMPLE_PATH = ".github/context/product.md.example";

/** 実 HOME（テストで HOME を差し替えても Deno のキャッシュは再利用する） */
const REAL_HOME = Deno.env.get("HOME") ?? "";

/** 実 DENO_DIR（HOME 差し替えによるネットワーク再取得を避ける） */
const REAL_DENO_DIR = Deno.env.get("DENO_DIR") ??
  (REAL_HOME ? join(REAL_HOME, ".cache", "deno") : "");

/** CLI 実行結果（JSON を解釈したもの） */
interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  json: {
    ok: boolean;
    source: string;
    checks: Array<{ path: string; tracked: boolean; status: string }>;
    warnings: string[];
  };
}

/** git を子プロセスで実行する（identity と global config を固定する） */
async function git(
  cwd: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const output = await new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
    env: {
      ...Deno.env.toObject(),
      HOME: cwd,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  }).output();

  const decoder = new TextDecoder("utf-8");
  return {
    code: output.code,
    stdout: decoder.decode(output.stdout).trim(),
    stderr: decoder.decode(output.stderr).trim(),
  };
}

/** temp の git リポジトリを作成する（初期コミット付き） */
async function createRepo(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "ghm-guard-repo-" });
  const init = await git(dir, ["init", "-b", "main", "."]);
  if (init.code !== 0) throw new Error(`git init failed: ${init.stderr}`);
  await Deno.writeTextFile(join(dir, "README.md"), "# test\n");
  await git(dir, ["add", "-A"]);
  const commit = await git(dir, ["commit", "-m", "init"]);
  if (commit.code !== 0) throw new Error(`git commit failed: ${commit.stderr}`);
  return dir;
}

/** リポジトリ内にファイルを書き、必要ならコミットする */
async function writeAndCommit(
  dir: string,
  relPath: string,
  content: string,
  commit: boolean,
): Promise<void> {
  const abs = join(dir, relPath);
  await Deno.mkdir(join(abs, ".."), { recursive: true });
  await Deno.writeTextFile(abs, content);
  if (commit) {
    await git(dir, ["add", relPath]);
    const result = await git(dir, ["commit", "-m", `add ${relPath}`]);
    if (result.code !== 0) throw new Error(`git commit failed: ${result.stderr}`);
  }
}

/** グローバル配置を模した HOME ディレクトリを作成する */
async function createHome(withGlobal: boolean): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "ghm-guard-home-" });
  if (withGlobal) {
    const target = join(dir, ".harness", "context", "management.md");
    await Deno.mkdir(join(target, ".."), { recursive: true });
    await Deno.writeTextFile(target, "# 管理概念（グローバル）\n");
  }
  return dir;
}

/** スクリプトを CLI として実行し、JSON を解釈して返す */
async function runCli(
  cwd: string,
  home: string,
  options: { useCwdFlag?: boolean } = {},
): Promise<CliResult> {
  const args = ["run", "-A", SCRIPT_PATH, "--home", home];
  if (options.useCwdFlag) args.push("--cwd", cwd);

  const output = await new Deno.Command(Deno.execPath(), {
    args,
    cwd: options.useCwdFlag ? home : cwd,
    stdout: "piped",
    stderr: "piped",
    env: { ...Deno.env.toObject(), HOME: home, DENO_DIR: REAL_DENO_DIR, GIT_CONFIG_NOSYSTEM: "1" },
  }).output();

  const decoder = new TextDecoder("utf-8");
  const stdout = decoder.decode(output.stdout);
  const stderr = decoder.decode(output.stderr);
  return { code: output.code, stdout, stderr, json: JSON.parse(stdout) };
}

/**
 * ユースケース: 正本がリポジトリに存在しない（配布先の典型）
 * 検証意図: fatal を出さず exit 0 で、グローバル参照を source として返すこと
 */
Deno.test("AC2: 正本不在リポジトリではグローバル参照へフォールバックする", async () => {
  const repo = await createRepo();
  const home = await createHome(true);
  try {
    const result = await runCli(repo, home);

    assertEquals(result.code, 0);
    assertEquals(result.json.ok, true);
    assertEquals(result.json.source, "global");
    assertNotMatch(result.stderr, /fatal/i, "git の fatal が出力されている");
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: 正本ファイルはあるが git 追跡されていない
 * 検証意図: 追跡外では diff を打たず、fatal を出さないこと
 */
Deno.test("AC2: 未追跡の正本があっても fatal にならない", async () => {
  const repo = await createRepo();
  const home = await createHome(true);
  try {
    await writeAndCommit(repo, MANAGEMENT_PATH, "# 管理概念\n", false);
    const result = await runCli(repo, home);

    assertEquals(result.code, 0);
    assertEquals(result.json.ok, true);
    assertEquals(result.json.source, "global");
    assert(result.json.warnings.length > 0, "追跡外である旨の警告が無い");
    assertNotMatch(result.stderr, /fatal/i);
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: 正本が追跡済みで無変更
 * 検証意図: ok=true / source=local で、チェック結果が ok であること
 */
Deno.test("AC2: 追跡済みの正本が無変更なら ok", async () => {
  const repo = await createRepo();
  const home = await createHome(false);
  try {
    await writeAndCommit(repo, MANAGEMENT_PATH, "# 管理概念\n", true);
    await writeAndCommit(repo, EXAMPLE_PATH, "# 見本\n", true);
    const result = await runCli(repo, home);

    assertEquals(result.code, 0);
    assertEquals(result.json.ok, true);
    assertEquals(result.json.source, "local");
    const management = result.json.checks.find((c) => c.path === MANAGEMENT_PATH);
    assertEquals(management?.tracked, true);
    assertEquals(management?.status, "ok");
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: 追跡済みの正本が誤って編集された
 * 検証意図: fail-closed（ok=false / exit 1）で違反を報告すること
 */
Deno.test("AC2: 追跡済みの正本が変更されていれば違反として exit 1", async () => {
  const repo = await createRepo();
  const home = await createHome(false);
  try {
    await writeAndCommit(repo, MANAGEMENT_PATH, "# 管理概念\n", true);
    await Deno.writeTextFile(join(repo, MANAGEMENT_PATH), "# 管理概念（改変）\n");

    const result = await runCli(repo, home);

    assertEquals(result.code, 1);
    assertEquals(result.json.ok, false);
    const management = result.json.checks.find((c) => c.path === MANAGEMENT_PATH);
    assertEquals(management?.status, "violation");
    assertNotMatch(result.stderr, /fatal/i);
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: 正本を編集して `git add` した状態（WIPセーブポイント直後）
 * 検証意図: ステージ済みの改変も違反として検出すること（fail-closed）
 */
Deno.test("AC2: ステージ済みの正本改変も違反として検出する", async () => {
  const repo = await createRepo();
  const home = await createHome(false);
  try {
    await writeAndCommit(repo, MANAGEMENT_PATH, "# 管理概念\n", true);
    await Deno.writeTextFile(join(repo, MANAGEMENT_PATH), "# 管理概念（改変）\n");
    const add = await git(repo, ["add", MANAGEMENT_PATH]);
    assertEquals(add.code, 0);

    const result = await runCli(repo, home);

    assertEquals(result.code, 1);
    assertEquals(result.json.ok, false);
    const management = result.json.checks.find((c) => c.path === MANAGEMENT_PATH);
    assertEquals(management?.status, "violation");
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: 構造見本（product.md.example）を誤って編集した
 * 検証意図: example 側の改変も違反として検出すること
 */
Deno.test("AC2: 構造見本の改変も違反として検出する", async () => {
  const repo = await createRepo();
  const home = await createHome(false);
  try {
    await writeAndCommit(repo, MANAGEMENT_PATH, "# 管理概念\n", true);
    await writeAndCommit(repo, EXAMPLE_PATH, "# 見本\n", true);
    await Deno.writeTextFile(join(repo, EXAMPLE_PATH), "# 見本（改変）\n");

    const result = await runCli(repo, home);

    assertEquals(result.code, 1);
    assertEquals(result.json.ok, false);
    const example = result.json.checks.find((c) => c.path === EXAMPLE_PATH);
    assertEquals(example?.status, "violation");
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: git status が失敗する（index.lock 競合など）
 * 検証意図: 例外を投げず、検証未完了を ok=false（error）として返すこと
 */
Deno.test("AC2: 差分を取得できない場合は fail-closed で error を返す", async () => {
  const runner: CommandRunner = (cmd, args) => {
    const key = `${cmd} ${args.join(" ")}`;
    const result = (code: number, stdout = "", stderr = ""): CommandResult => ({
      code,
      stdout,
      stderr,
    });

    if (key === "git rev-parse --show-toplevel") return Promise.resolve(result(0, "/tmp/fake\n"));
    if (key === `git ls-files --error-unmatch -- ${MANAGEMENT_PATH}`) {
      return Promise.resolve(result(0, `${MANAGEMENT_PATH}\n`));
    }
    if (key === `git status --porcelain -- ${MANAGEMENT_PATH}`) {
      return Promise.resolve(result(128, "", "fatal: index.lock exists"));
    }
    return Promise.resolve(result(1));
  };

  const outcome = await verifyImmutableContext({
    cwd: "/tmp/fake",
    home: "/tmp/fake-home",
    run: runner,
  });

  assertEquals(outcome.ok, false);
  const management = outcome.checks.find((c) => c.path === MANAGEMENT_PATH);
  assertEquals(management?.status, "error");
});

/**
 * ユースケース: ローカルにもグローバルにも正本が無い（環境不備）
 * 検証意図: 停止せず exit 0 で warning を返すこと（環境検査は他スキルの責務）
 */
Deno.test("AC2: 両方に正本が無くても exit 0 で warning を返す", async () => {
  const repo = await createRepo();
  const home = await createHome(false);
  try {
    const result = await runCli(repo, home);

    assertEquals(result.code, 0);
    assertEquals(result.json.ok, true);
    assertEquals(result.json.source, "none");
    assert(result.json.warnings.length > 0);
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: git リポジトリではないディレクトリで実行する
 * 検証意図: --cwd 指定でも no-git として exit 0 で返り、停止しないこと
 */
Deno.test("AC2: git リポジトリ外では no-git で exit 0", async () => {
  const plain = await Deno.makeTempDir({ prefix: "ghm-guard-plain-" });
  const home = await createHome(true);
  try {
    const result = await runCli(plain, home, { useCwdFlag: true });

    assertEquals(result.code, 0);
    assertEquals(result.json.source, "no-git");
    assertNotMatch(result.stderr, /fatal/i);
  } finally {
    await Deno.remove(plain, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: ガードを繰り返し実行する
 * 検証意図: 同じ環境で2回実行しても結果が変わらないこと（冪等）
 */
Deno.test("AC2: ガードは冪等に動作する", async () => {
  const repo = await createRepo();
  const home = await createHome(true);
  try {
    const first = await runCli(repo, home);
    const second = await runCli(repo, home);

    assertEquals(first.json, second.json);
    assertEquals(first.code, second.code);
  } finally {
    await Deno.remove(repo, { recursive: true });
    await Deno.remove(home, { recursive: true });
  }
});

/**
 * ユースケース: 手順書（edits.md §4 / SKILL.md 手順4）の記載
 * 検証意図: 未追跡パスへの git diff 直書きが無くなり、ガードスクリプトを参照していること
 */
Deno.test("AC2: edits.md と SKILL.md がガードスクリプトを参照する", async () => {
  const edits = await Deno.readTextFile(EDITS_PATH);
  const skill = await Deno.readTextFile(SKILL_PATH);

  assertMatch(edits, /verify_immutable_context\.ts/);
  assertNotMatch(edits, /git diff --name-only \.github\/context\/management\.md/);
  assertMatch(edits, /未追跡|追跡有無/);
  assertMatch(skill, /verify_immutable_context\.ts/);
});
