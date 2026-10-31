/**
 * resolve_base_branch_test.ts — 分岐元（ベースブランチ）解決の検証
 *
 * AC1: git系スキル（merge-branch / create-pull-request / hybrid-triage-commit /
 *      initialize-branch）が分岐元を動的解決し、master 既定のリポジトリで
 *      `pathspec 'main' did not match` により停止しないこと。
 *
 * 方針:
 * - 解決ロジックは実行結果で検証する（temp リポジトリ / fake runner）。
 * - 「停止しない」ことは、解決値を使って実際に git コマンドが成功することで検証する。
 * - スキル本文・トリアージスクリプトの `main` 決め打ちは構造検査で検証する。
 */

import { assert, assertEquals, assertMatch, assertNotMatch } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import {
  type CommandResult,
  type CommandRunner,
  resolveBaseBranch,
} from "./resolve_base_branch.ts";

/** このテストファイルのディレクトリ（.opencode/core/shared/git） */
const SCRIPT_DIR = fromFileUrl(new URL(".", import.meta.url));

/** リポジトリルート（.opencode/core/shared/git → 4階層上） */
const REPO_ROOT = fromFileUrl(new URL("../../../../", import.meta.url));

/** 解決スクリプトの絶対パス（CLI テスト用） */
const SCRIPT_PATH = join(SCRIPT_DIR, "resolve_base_branch.ts");

/** スキル文書のルート */
const GIT_BUNDLE = join(REPO_ROOT, ".opencode/skills/bundles/git-bundle");

/** 解決スクリプトを参照する表記（ドキュメント検査用） */
const SCRIPT_REF = ".opencode/core/shared/git/resolve_base_branch.ts";

/** 実 HOME（テストで HOME を差し替える際、Deno のキャッシュだけは元に戻す） */
const REAL_HOME = Deno.env.get("HOME") ?? "";

/** 実 DENO_DIR（HOME 差し替えによるネットワーク再取得を避ける） */
const REAL_DENO_DIR = Deno.env.get("DENO_DIR") ??
  (REAL_HOME ? join(REAL_HOME, ".cache", "deno") : "");

/** git を子プロセスで実行し、終了コードと出力を返す（identity と global config を固定する） */
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

/** 指定した初期ブランチ名で temp リポジトリを作成する（テスト後に削除する前提） */
async function createRepo(initialBranch: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "ghm-base-branch-" });
  const result = await git(dir, ["init", "-b", initialBranch, "."]);
  if (result.code !== 0) throw new Error(`git init failed: ${result.stderr}`);
  return dir;
}

/** temp リポジトリに1コミットを作成し、その SHA を返す */
async function commitFile(
  dir: string,
  fileName: string,
  message: string,
): Promise<string> {
  await Deno.writeTextFile(join(dir, fileName), `${message}\n`);
  await git(dir, ["add", "-A"]);
  const commit = await git(dir, ["commit", "-m", message]);
  if (commit.code !== 0) throw new Error(`git commit failed: ${commit.stderr}`);
  const head = await git(dir, ["rev-parse", "HEAD"]);
  return head.stdout;
}

/** リモート追跡 ref をローカルに直接作成する（remote を用意せず origin/HEAD を再現する） */
async function setRemoteRef(dir: string, ref: string, sha: string): Promise<void> {
  const result = await git(dir, ["update-ref", ref, sha]);
  if (result.code !== 0) throw new Error(`update-ref failed: ${result.stderr}`);
}

/** テスト用の偽コマンド実行器。未定義のコマンドは失敗（code=1）として扱う */
function makeFakeRunner(
  table: Record<string, CommandResult>,
): { run: CommandRunner; calls: string[]; misses: string[] } {
  const calls: string[] = [];
  const misses: string[] = [];
  const run: CommandRunner = (cmd, args) => {
    const key = `${cmd} ${args.join(" ")}`.trim();
    calls.push(key);
    const hit = table[key];
    if (!hit) misses.push(key);
    return Promise.resolve(hit ?? { code: 1, stdout: "", stderr: "" });
  };
  return { run, calls, misses };
}

/** キー文字列から成功結果を作る補助 */
function ok(stdout: string): CommandResult {
  return { code: 0, stdout, stderr: "" };
}

/**
 * ユースケース: master を既定とするリポジトリで、master 上から解決する
 * 検証意図: main を決め打ちせず、リモート既定ブランチ（origin/HEAD）から master を得ること
 */
Deno.test("AC1: origin/HEAD が master のリポジトリで master を返す", async () => {
  const dir = await createRepo("master");
  try {
    const head = await commitFile(dir, "a.txt", "init");
    await setRemoteRef(dir, "refs/remotes/origin/master", head);
    await git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master"]);

    const resolved = await resolveBaseBranch({ cwd: dir });

    assertEquals(resolved.baseBranch, "master");
    assertEquals(resolved.source, "remote-head");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: master 既定リポジトリの作業ブランチ上で解決する（AC1 の文言そのもの）
 * 検証意図: 解決値を用いた `git log <base>..HEAD` が成功し、`pathspec 'main'` で停止しないこと
 */
Deno.test("AC1: master 既定でも解決値で git コマンドが停止しない", async () => {
  const dir = await createRepo("master");
  try {
    const head = await commitFile(dir, "a.txt", "init");
    await setRemoteRef(dir, "refs/remotes/origin/master", head);
    await git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master"]);
    await git(dir, ["checkout", "-b", "fix/demo"]);
    await commitFile(dir, "b.txt", "work");

    const resolved = await resolveBaseBranch({ cwd: dir });

    // 旧手順（main 決め打ち）はここで fatal になる
    const oldStyle = await git(dir, ["log", "main..HEAD"]);
    assert(oldStyle.code !== 0, "main 決め打ちが成功してしまう前提が崩れている");

    const log = await git(dir, ["log", `${resolved.baseBranch}..HEAD`, "--oneline"]);
    assertEquals(log.code, 0, "解決値を用いた git log が失敗している");
    assert(log.stdout.includes("work"), "分岐元からの差分が取得できていない");

    const checkout = await git(dir, ["checkout", "--quiet", resolved.baseBranch]);
    assertEquals(checkout.code, 0, "解決値を用いた git checkout が失敗している");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: develop から分岐した作業ブランチでベースを解決する
 * 検証意図: リモート既定（origin/HEAD=origin/main）ではなく、fork point が最も近い develop を選ぶこと
 */
Deno.test("AC1: fork point が最も近いリモートブランチ（develop）を返す", async () => {
  const dir = await createRepo("main");
  try {
    const mainTip = await commitFile(dir, "a.txt", "main-1");
    await git(dir, ["checkout", "-b", "develop"]);
    const developTip = await commitFile(dir, "b.txt", "develop-1");
    await git(dir, ["checkout", "-b", "feat/one"]);
    await commitFile(dir, "c.txt", "feat-1");

    await setRemoteRef(dir, "refs/remotes/origin/main", mainTip);
    await setRemoteRef(dir, "refs/remotes/origin/develop", developTip);
    await git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

    const resolved = await resolveBaseBranch({ cwd: dir });

    assertEquals(resolved.baseBranch, "develop");
    assertEquals(resolved.source, "fork-point");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: 子ブランチの上に積んだブランチ（stacked PR）の親側で解決する
 * 検証意図: 子孫ブランチ（HEAD を含む側）を分岐元に選ばないこと
 */
Deno.test("AC1: 子孫ブランチを分岐元に選ばない（stacked PR）", async () => {
  const dir = await createRepo("main");
  try {
    const mainTip = await commitFile(dir, "m.txt", "main");
    await git(dir, ["checkout", "-b", "feat/a"]);
    const aTip = await commitFile(dir, "a.txt", "a-work");
    await git(dir, ["checkout", "-b", "feat/b"]);
    const bTip = await commitFile(dir, "b.txt", "b-work");

    await setRemoteRef(dir, "refs/remotes/origin/main", mainTip);
    await setRemoteRef(dir, "refs/remotes/origin/feat/a", aTip);
    await setRemoteRef(dir, "refs/remotes/origin/feat/b", bTip);
    await git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
    await git(dir, ["checkout", "--quiet", "feat/a"]);

    const resolved = await resolveBaseBranch({ cwd: dir });

    assertEquals(resolved.baseBranch, "main");
    assertEquals(resolved.source, "fork-point");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: リモートを持たない master 既定リポジトリ（配布先の素の状態）
 * 検証意図: ローカルブランチを候補に含め、main へフォールバックしないこと
 */
Deno.test("AC1: リモート無しの master 既定リポジトリでも master を返す", async () => {
  const dir = await createRepo("master");
  try {
    await commitFile(dir, "a.txt", "init");
    await git(dir, ["checkout", "-b", "feat/x"]);
    await commitFile(dir, "b.txt", "work");

    const resolved = await resolveBaseBranch({ cwd: dir });

    assertEquals(resolved.baseBranch, "master");
    assertEquals(resolved.source, "fork-point");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: fork point が同点になる複数ブランチがある
 * 検証意図: 同点時はリモート既定ブランチ（origin/HEAD の指す先）を優先すること
 */
Deno.test("AC1: fork point が同点なら origin/HEAD のブランチを優先する", async () => {
  const dir = await createRepo("master");
  try {
    const base = await commitFile(dir, "a.txt", "base");
    await git(dir, ["checkout", "-b", "feat/tie"]);
    await commitFile(dir, "b.txt", "work");

    await setRemoteRef(dir, "refs/remotes/origin/master", base);
    await setRemoteRef(dir, "refs/remotes/origin/alt", base);
    await git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master"]);

    const resolved = await resolveBaseBranch({ cwd: dir });

    assertEquals(resolved.baseBranch, "master");
    assertEquals(resolved.source, "fork-point");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: 分岐元を PO/AI が明示指定する
 * 検証意図: --base（explicitBase）が最優先で採用され、git コマンドを一切実行しないこと
 */
Deno.test("AC1: --base 指定は最優先で採用される", async () => {
  const { run, calls } = makeFakeRunner({});
  const resolved = await resolveBaseBranch({ explicitBase: "release/1.2", run });

  assertEquals(resolved, { baseBranch: "release/1.2", source: "explicit" });
  assertEquals(calls.length, 0);
});

/**
 * ユースケース: 不正な --base 指定（HEAD・オプション・rev範囲・reflog・空文字）
 * 検証意図: 不正値は明示指定として扱わず、通常の解決へフォールバックすること
 */
Deno.test("AC1: 不正な --base は無視して解決を継続する", async () => {
  const invalidValues = [
    "",
    "  ",
    "HEAD",
    ".",
    "-D",
    "a..b",
    "main@{1}",
    "feat/",
    "/x",
    "refs/heads/main",
    "origin/HEAD",
  ];
  for (const invalid of invalidValues) {
    const { run } = makeFakeRunner({});
    const resolved = await resolveBaseBranch({ explicitBase: invalid, run });
    assertEquals(resolved, { baseBranch: "main", source: "fallback" }, `input=${invalid}`);
  }
});

/**
 * ユースケース: PRが既に存在し、その宛先が分岐元と異なる（release ブランチ等）
 * 検証意図: `--from-pr` が PR の baseRefName を事実として最優先で採用すること
 */
Deno.test("AC1: --from-pr は PR の宛先を最優先で採用する", async () => {
  const { run, misses } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "gh pr view 888 --json baseRefName --jq .baseRefName": ok("release/1.2\n"),
  });

  const resolved = await resolveBaseBranch({ fromPr: 888, run });

  assertEquals(resolved, { baseBranch: "release/1.2", source: "pr-base" });
  assertEquals(misses, [], "想定外のコマンドが呼ばれている");
});

/**
 * ユースケース: gh が失敗して PR の宛先を取得できない
 * 検証意図: 停止せず、従来の推定へフォールバックすること
 */
Deno.test("AC1: --from-pr が失敗したら推定へフォールバックする", async () => {
  const { run } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "git rev-parse --abbrev-ref HEAD": ok("feat/one\n"),
    "git symbolic-ref --short refs/remotes/origin/HEAD": ok("origin/master\n"),
    "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": ok(""),
    "git for-each-ref --format=%(refname:short) refs/remotes/": ok("origin/master\n"),
    "git for-each-ref --format=%(refname:short) refs/heads/": ok("feat/one\n"),
    "git merge-base --is-ancestor origin/master HEAD": ok(""),
    "git rev-list --count origin/master..HEAD": ok("3\n"),
  });

  const resolved = await resolveBaseBranch({ fromPr: 999, run });

  assertEquals(resolved, { baseBranch: "master", source: "fork-point" });
});

/**
 * ユースケース: `--from-pr` に不正な値（数字以外）が渡された
 * 検証意図: gh を呼ばずに無視し、通常の解決へ進むこと
 */
Deno.test("AC1: 不正な --from-pr は gh を呼ばずに無視する", async () => {
  const { run, calls } = makeFakeRunner({});

  const resolved = await resolveBaseBranch({ fromPr: "888; rm -rf /", run });

  assertEquals(resolved, { baseBranch: "main", source: "fallback" });
  assert(!calls.some((call) => call.startsWith("gh pr view")), "gh pr view が呼ばれている");
});

/**
 * ユースケース: 上流追跡ブランチが分岐元と異なる（--track origin/develop）
 * 検証意図: 上流ブランチ名をリモート接頭辞抜きで採用し、fork point 探索を行わないこと
 */
Deno.test("AC1: 上流追跡ブランチをベースとして採用する", async () => {
  const { run, calls } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "git rev-parse --abbrev-ref HEAD": ok("feat/one\n"),
    "git symbolic-ref --short refs/remotes/origin/HEAD": ok("origin/main\n"),
    "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": ok("origin/develop\n"),
    "git rev-parse --abbrev-ref origin/HEAD": ok("origin/main\n"),
  });

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "develop", source: "upstream" });
  assert(!calls.some((c) => c.startsWith("git for-each-ref")), "fork point 探索は実行されない");
});

/**
 * ユースケース: 上流が自分自身（push 済みブランチ）
 * 検証意図: 自分自身をベースにせず、fork point 探索へ進むこと
 */
Deno.test("AC1: 上流が自分自身ならベースにしない", async () => {
  const { run, misses } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "git rev-parse --abbrev-ref HEAD": ok("feat/one\n"),
    "git symbolic-ref --short refs/remotes/origin/HEAD": ok("origin/master\n"),
    "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": ok("origin/feat/one\n"),
    "git for-each-ref --format=%(refname:short) refs/remotes/": ok("origin/HEAD\norigin/master\n"),
    "git for-each-ref --format=%(refname:short) refs/heads/": ok("feat/one\nmaster\n"),
    "git merge-base --is-ancestor origin/master HEAD": ok(""),
    "git rev-list --count origin/master..HEAD": ok("2\n"),
    "git merge-base --is-ancestor master HEAD": ok(""),
    "git rev-list --count master..HEAD": ok("2\n"),
  });

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "master", source: "fork-point" });
  assertEquals(misses, [], "想定外のコマンドが呼ばれている");
});

/**
 * ユースケース: origin/HEAD が symbolic-ref で取れない環境
 * 検証意図: 第2経路（rev-parse --abbrev-ref origin/HEAD）で解決できること
 */
Deno.test("AC1: origin/HEAD が symbolic-ref で取れない場合は第2経路を使う", async () => {
  const { run } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "git rev-parse --abbrev-ref HEAD": ok("feat/one\n"),
    "git rev-parse --abbrev-ref origin/HEAD": ok("origin/trunk\n"),
    "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": ok(""),
    "git for-each-ref --format=%(refname:short) refs/remotes/": ok(""),
    "git for-each-ref --format=%(refname:short) refs/heads/": ok("feat/one\n"),
  });

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "trunk", source: "remote-head" });
});

/**
 * ユースケース: origin/HEAD が未設定の fresh clone
 * 検証意図: gh CLI の既定ブランチへフォールバックすること
 */
Deno.test("AC1: origin/HEAD 未設定時は gh の既定ブランチを使う", async () => {
  const { run, calls } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "git rev-parse --abbrev-ref HEAD": ok("feat/one\n"),
    "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": ok(""),
    "git for-each-ref --format=%(refname:short) refs/remotes/": ok(""),
    "git for-each-ref --format=%(refname:short) refs/heads/": ok("feat/one\n"),
    "gh repo view --json defaultBranchRef --jq .defaultBranchRef.name": ok("trunk\n"),
  });

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "trunk", source: "github-default" });
  assert(calls.includes("gh repo view --json defaultBranchRef --jq .defaultBranchRef.name"));
});

/**
 * ユースケース: gh 未認証・未インストール
 * 検証意図: 失敗しても停止せず init.defaultBranch を使うこと
 */
Deno.test("AC1: gh が失敗しても init.defaultBranch で継続する", async () => {
  const { run } = makeFakeRunner({
    "git remote": ok("origin\n"),
    "git rev-parse --abbrev-ref HEAD": ok("feat/one\n"),
    "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": ok(""),
    "git for-each-ref --format=%(refname:short) refs/remotes/": ok(""),
    "git for-each-ref --format=%(refname:short) refs/heads/": ok("feat/one\n"),
    "git config --get init.defaultBranch": ok("trunk\n"),
  });

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "trunk", source: "init-default" });
});

/**
 * ユースケース: あらゆる手掛かりが無い（空リポジトリ・リモート無し・ブランチ無し）
 * 検証意図: 例外を投げず、最終フォールバック main を返すこと
 */
Deno.test("AC1: 解決できない場合は main へフォールバックする", async () => {
  const { run } = makeFakeRunner({});

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "main", source: "fallback" });
});

/**
 * ユースケース: 注入した実行関数が例外を投げる（git 不在など）
 * 検証意図: 例外を伝播させず、fallback で返ること（AC1「停止しない」）
 */
Deno.test("AC1: 実行関数が throw しても例外を伝播しない", async () => {
  const run: CommandRunner = () => {
    throw new Error("git not found");
  };

  const resolved = await resolveBaseBranch({ run });

  assertEquals(resolved, { baseBranch: "main", source: "fallback" });
});

/**
 * ユースケース: git リポジトリでないディレクトリで CLI を実行する
 * 検証意図: 例外で異常終了せず、exit 0 で JSON（fallback）を返すこと
 */
Deno.test("AC1: CLI は非 git ディレクトリでも exit 0 で JSON を返す", async () => {
  const dir = await Deno.makeTempDir({ prefix: "ghm-base-nogit-" });
  try {
    const output = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", SCRIPT_PATH, "--cwd", dir],
      stdout: "piped",
      stderr: "piped",
      env: {
        ...Deno.env.toObject(),
        HOME: dir,
        DENO_DIR: REAL_DENO_DIR,
        GIT_CONFIG_NOSYSTEM: "1",
      },
    }).output();

    const stdout = new TextDecoder("utf-8").decode(output.stdout).trim();
    assertEquals(output.code, 0);
    const parsed = JSON.parse(stdout);
    assertEquals(parsed.baseBranch, "main");
    assertEquals(parsed.source, "fallback");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

/**
 * ユースケース: merge-branch / create-pull-request / initialize-branch の手順書
 * 検証意図: 解決スクリプトを参照し、main 決め打ちのコマンドが残っていないこと
 */
Deno.test("AC1: git系スキルの手順書が分岐元解決を参照する", async () => {
  const skillPaths = [
    join(GIT_BUNDLE, "merge-branch/SKILL.md"),
    join(GIT_BUNDLE, "create-pull-request/SKILL.md"),
    join(GIT_BUNDLE, "initialize-branch/SKILL.md"),
  ];

  for (const path of skillPaths) {
    const content = await Deno.readTextFile(path);
    assertMatch(
      content,
      new RegExp(SCRIPT_REF.replace(/\./g, "\\.")),
      `${path}: 解決スクリプトの参照が無い`,
    );
    assertMatch(content, /<base>/, `${path}: <base> プレースホルダが無い`);
    assertNotMatch(content, /git checkout main\b/, `${path}: git checkout main が残存`);
    assertNotMatch(content, /git pull origin main\b/, `${path}: git pull origin main が残存`);
    assertNotMatch(content, /git log main\.\.HEAD/, `${path}: git log main..HEAD が残存`);
  }

  const triageSkill = await Deno.readTextFile(
    join(GIT_BUNDLE, "hybrid-triage-commit/SKILL.md"),
  );
  assertMatch(triageSkill, new RegExp(SCRIPT_REF.replace(/\./g, "\\.")));
});

/**
 * ユースケース: hybrid-triage-commit の triage モード
 * 検証意図: 私有の getDefaultBranch（main 決め打ち）を廃止し、共有解決スクリプトを使うこと
 */
Deno.test("AC1: git-triage が共有の分岐元解決を使う", async () => {
  const path = join(GIT_BUNDLE, "hybrid-triage-commit/scripts/git-triage.ts");
  const content = await Deno.readTextFile(path);

  assertMatch(content, /resolveBaseBranch/);
  assertMatch(
    content,
    /core\/shared\/git\/resolve_base_branch\.ts/,
    "配布可能な core 配置を参照していない",
  );
  assertNotMatch(content, /getDefaultBranch/, "私有の getDefaultBranch が残存");
  assertMatch(content, /explicitBase/, "--base を解決関数へ渡していない");
});
