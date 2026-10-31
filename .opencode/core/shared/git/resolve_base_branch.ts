/**
 * resolve_base_branch.ts — 作業ブランチの「分岐元（ベースブランチ）」を解決する
 *
 * PRの宛先・マージ後の復帰先・トリアージの diff 基準は、いずれも
 * 「作業ブランチがどこから分岐したか（分岐元）」で決まる。
 * リモート既定ブランチ（origin/HEAD）は、分岐元を推定できない場合の代理指標にすぎない。
 *
 * 解決順（最初に成功したものを採用する）:
 *   0. `--base` 明示指定                       → source: "explicit"
 *   1. PRの宛先（`--from-pr <N>` の baseRefName）→ source: "pr-base"
 *   2. 上流追跡ブランチ（自分自身でない場合）  → source: "upstream"
 *   3. 現在ブランチ == リモート既定ブランチ    → source: "remote-head"
 *   4. fork point が最も近いブランチ           → source: "fork-point"
 *      （リモート追跡ブランチと**ローカルブランチ**の両方を候補にする。
 *        HEAD の子孫・無関係なブランチは候補から除外する）
 *   5. リモート既定ブランチ（origin/HEAD）     → source: "remote-head"
 *   6. GitHub の既定ブランチ（gh）             → source: "github-default"
 *   7. init.defaultBranch                      → source: "init-default"
 *   8. 最終フォールバック（main）              → source: "fallback"
 *
 * どの経路でも exit 0 で `{"baseBranch":"...","source":"..."}` を出力する。
 * 解決失敗でワークフローを停止させないことが本スクリプトの要件である。
 *
 * 既知の限界:
 * - shallow clone / rebase・cherry-pick 後の履歴 / 未pushのローカル分岐元では fork point を誤判定しうる。
 *   その場合は 4 以降へ落ちるため「停止はしないが、既定ブランチ宛になる」。
 *   PR作成時に `<base>` を提示して PO に確認を取ることで担保する。
 *
 * 使用方法:
 *   deno run -A resolve_base_branch.ts [--cwd <path>] [--base <branch>] [--from-pr <N>]
 */

import { parseArgs } from "@std/cli";

/** 解決できなかった場合の最終フォールバック */
const FALLBACK_BASE_BRANCH = "main";

/** gh CLI の応答待ち上限（ミリ秒）。未認証・SSO・ネットワーク断でハングしないため
 * （この環境では 1 API 呼び出しに約20秒かかる実測があるため、30秒を上限とする） */
const GH_TIMEOUT_MS = 30000;

/**
 * コマンド実行結果。
 * @property code - 終了コード（0 が成功）
 * @property stdout - 標準出力
 * @property stderr - 標準エラー出力
 */
export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * コマンド実行関数。テストでは偽物を注入する。
 * @param cmd - 実行ファイル名（git / gh 等）
 * @param args - 引数リスト
 * @param cwd - 実行ディレクトリ
 * @returns 終了コードと出力
 */
export type CommandRunner = (
  cmd: string,
  args: string[],
  cwd: string,
) => Promise<CommandResult>;

/**
 * ベースブランチの解決根拠。
 */
export type BaseBranchSource =
  | "explicit"
  | "pr-base"
  | "upstream"
  | "fork-point"
  | "remote-head"
  | "github-default"
  | "init-default"
  | "fallback";

/**
 * 解決結果。
 * @property baseBranch - ベースブランチ名（リモート接頭辞なし）
 * @property source - どの判定で決まったか
 */
export interface ResolvedBaseBranch {
  baseBranch: string;
  source: BaseBranchSource;
}

/**
 * 解決オプション。
 * @property cwd - 対象リポジトリのディレクトリ（既定はプロセスのカレント）
 * @property explicitBase - `--base` による明示指定
 * @property fromPr - `--from-pr` で指定した PR 番号（PRの宛先を最優先で採用する）
 * @property run - コマンド実行関数（既定は実プロセス実行）
 * @property allowGh - gh CLI による解決を許可するか（既定 true）
 */
export interface ResolveOptions {
  cwd?: string;
  explicitBase?: string;
  fromPr?: string | number;
  run?: CommandRunner;
  allowGh?: boolean;
}

/**
 * ブランチ名として妥当かどうかを判定する。
 * 解決結果をそのままシェルに渡すため、空白・制御文字・シェルメタ文字を拒否する。
 * @param name - 判定対象の文字列
 * @returns 妥当なら true
 */
function isValidBranchName(name: string): boolean {
  return /^[A-Za-z0-9._/+@-]+$/.test(name);
}

/**
 * `--base` の明示指定を正規化する。
 * リモート接頭辞は剥がさない（`release/1.2` のような名前を壊さないため）。
 * @param value - 明示指定された値
 * @returns 正規化済みのブランチ名、または無効なら null
 */
export function sanitizeExplicitBase(value?: string | null): string | null {
  if (!value) return null;
  const name = value.trim();
  if (!name || name === "HEAD" || name === ".") return null;
  if (name.startsWith("-")) return null; // git オプションとして解釈される
  if (name.startsWith("/") || name.endsWith("/")) return null;
  if (name.includes("..")) return null; // リビジョン範囲
  if (name.includes("@{")) return null; // reflog 指定
  if (name.startsWith("refs/")) return null;
  if (name.endsWith("/HEAD")) return null;
  if (!isValidBranchName(name)) return null;
  return name;
}

/**
 * git の出力（`origin/main` や `refs/remotes/origin/main`）をブランチ名へ正規化する。
 * @param value - git の出力値
 * @param remotes - 既知のリモート名（`origin` は常に対象）
 * @returns ブランチ名、または解釈できない場合は null
 */
export function toBranchName(
  value?: string | null,
  remotes: string[] = [],
): string | null {
  if (!value) return null;
  let name = value.trim();
  if (!name) return null;

  if (name.startsWith("refs/remotes/")) name = name.slice("refs/remotes/".length);
  else if (name.startsWith("refs/heads/")) name = name.slice("refs/heads/".length);

  for (const remote of ["origin", ...remotes]) {
    if (name.startsWith(`${remote}/`)) {
      name = name.slice(remote.length + 1);
      break;
    }
  }

  if (!name || name === "HEAD") return null;
  if (!isValidBranchName(name)) return null;
  return name;
}

/**
 * 実プロセスでコマンドを実行する既定の実行関数。
 * 実行ファイルが存在しない場合も例外にせず code=127 を返す（常に継続させる）。
 * `gh` はネットワーク待ちでハングしうるため、上限時間で打ち切る。
 * @param cmd - 実行ファイル名
 * @param args - 引数リスト
 * @param cwd - 実行ディレクトリ
 * @returns 終了コードと出力
 */
export async function defaultRunner(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  try {
    const output = await new Deno.Command(cmd, {
      args,
      cwd,
      stdout: "piped",
      stderr: "piped",
      signal: cmd === "gh" ? AbortSignal.timeout(GH_TIMEOUT_MS) : undefined,
    }).output();

    const decoder = new TextDecoder("utf-8");
    return {
      code: output.code,
      stdout: decoder.decode(output.stdout),
      stderr: decoder.decode(output.stderr),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { code: 124, stdout: "", stderr: "command timed out" };
    }
    return { code: 127, stdout: "", stderr: String(error) };
  }
}

/**
 * 複数行のコマンド出力を、空行を除いた配列へ変換する。
 * @param text - コマンドの標準出力
 * @returns 前後の空白を除去した非空行の一覧
 */
function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * リモート既定ブランチ（origin/HEAD の指す先）を取得する。
 * 古い git や `origin/HEAD` 未設定の環境では `symbolic-ref` が失敗するため二段構えにする。
 * @param run - コマンド実行関数
 * @param cwd - 実行ディレクトリ
 * @param remotes - 既知のリモート名
 * @returns ブランチ名、または取得できなければ null
 */
async function detectRemoteHead(
  run: CommandRunner,
  cwd: string,
  remotes: string[],
): Promise<string | null> {
  const symbolic = await run(
    "git",
    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    cwd,
  );
  if (symbolic.code === 0) {
    const name = toBranchName(symbolic.stdout, remotes);
    if (name) return name;
  }

  const abbrev = await run("git", ["rev-parse", "--abbrev-ref", "origin/HEAD"], cwd);
  if (abbrev.code === 0) {
    const name = toBranchName(abbrev.stdout, remotes);
    if (name) return name;
  }

  return null;
}

/**
 * 既知のリモート名を取得する。
 * @param run - コマンド実行関数
 * @param cwd - 実行ディレクトリ
 * @returns リモート名の一覧（取得できなければ空配列）
 */
async function detectRemotes(run: CommandRunner, cwd: string): Promise<string[]> {
  const result = await run("git", ["remote"], cwd);
  if (result.code !== 0) return [];
  return splitLines(result.stdout);
}

/**
 * 上流追跡ブランチ（自分自身を除く）を取得する。
 * push 済みブランチでは上流が自分自身になるため、その場合はベースにしない。
 * @param run - コマンド実行関数
 * @param cwd - 実行ディレクトリ
 * @param remotes - 既知のリモート名
 * @param currentBranch - 現在のブランチ名
 * @returns 上流ブランチ名、または該当なしなら null
 */
async function detectUpstream(
  run: CommandRunner,
  cwd: string,
  remotes: string[],
  currentBranch: string | null,
): Promise<string | null> {
  const result = await run(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    cwd,
  );
  if (result.code !== 0) return null;

  const name = toBranchName(result.stdout, remotes);
  if (!name || name === currentBranch) return null;
  return name;
}

/**
 * PRが持つ宛先（`baseRefName`）を取得する。
 * PRが既に存在する場合、宛先は推測ではなく事実であり、これを最優先する。
 * gh の失敗・不正な番号は null を返し、通常の推定へ委ねる。
 * @param run - コマンド実行関数
 * @param cwd - 実行ディレクトリ
 * @param remotes - 既知のリモート名
 * @param fromPr - PR番号（未指定なら null）
 * @returns ブランチ名、または取得できなければ null
 */
async function detectPullRequestBase(
  run: CommandRunner,
  cwd: string,
  remotes: string[],
  fromPr?: string | number,
): Promise<string | null> {
  if (fromPr === undefined || fromPr === null) return null;

  const raw = String(fromPr).trim();
  // 数字のみを許可する（コマンド引数への混入を防ぐ）
  if (!/^\d{1,10}$/.test(raw)) return null;

  const result = await run(
    "gh",
    ["pr", "view", raw, "--json", "baseRefName", "--jq", ".baseRefName"],
    cwd,
  );
  if (result.code !== 0) return null;

  return toBranchName(result.stdout, remotes);
}

/**
 * 候補 ref を列挙する（リモート追跡とローカルの両方）。
 * @param run - コマンド実行関数
 * @param cwd - 実行ディレクトリ
 * @param remotes - 既知のリモート名
 * @param currentBranch - 現在のブランチ名
 * @returns 正規化済みの候補一覧
 */
async function collectCandidates(
  run: CommandRunner,
  cwd: string,
  remotes: string[],
  currentBranch: string | null,
): Promise<Array<{ ref: string; name: string }>> {
  const candidates: Array<{ ref: string; name: string }> = [];
  const seen = new Set<string>();

  for (const namespace of ["refs/remotes/", "refs/heads/"]) {
    const list = await run(
      "git",
      ["for-each-ref", "--format=%(refname:short)", namespace],
      cwd,
    );
    if (list.code !== 0) continue;

    for (const raw of splitLines(list.stdout)) {
      if (!raw || raw.endsWith("/HEAD")) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);

      const name = toBranchName(raw, remotes);
      if (!name || name === currentBranch) continue;
      candidates.push({ ref: raw, name });
    }
  }

  return candidates;
}

/**
 * fork point が最も近いブランチを推定する。
 * `HEAD` の祖先である候補のみを対象とし、`<ref>..HEAD` のコミット数が最小のものを分岐元とみなす。
 * 子孫ブランチ（HEAD を含む側）は、たとえ 0 コミットでも分岐元ではないため除外する。
 * 同点の場合はリモート既定ブランチを優先し、それも無ければ ref 名順で決める。
 * @param run - コマンド実行関数
 * @param cwd - 実行ディレクトリ
 * @param remotes - 既知のリモート名
 * @param currentBranch - 現在のブランチ名
 * @param remoteHead - リモート既定ブランチ名
 * @returns 推定した分岐元、または該当なしなら null
 */
async function detectForkPoint(
  run: CommandRunner,
  cwd: string,
  remotes: string[],
  currentBranch: string | null,
  remoteHead: string | null,
): Promise<string | null> {
  const candidates = await collectCandidates(run, cwd, remotes, currentBranch);
  const scored: Array<{ ref: string; name: string; count: number }> = [];

  for (const candidate of candidates) {
    const ancestor = await run(
      "git",
      ["merge-base", "--is-ancestor", candidate.ref, "HEAD"],
      cwd,
    );
    // 祖先でない（= 子孫・無関係）候補は分岐元になり得ない
    if (ancestor.code !== 0) continue;

    const countResult = await run(
      "git",
      ["rev-list", "--count", `${candidate.ref}..HEAD`],
      cwd,
    );
    if (countResult.code !== 0) continue;
    const count = Number.parseInt(countResult.stdout.trim(), 10);
    if (Number.isNaN(count)) continue;

    scored.push({ ref: candidate.ref, name: candidate.name, count });
  }

  if (scored.length === 0) return null;

  // 同名（origin/main とローカル main など）は最も近い方を採用する
  const byName = new Map<string, { ref: string; name: string; count: number }>();
  for (const candidate of scored) {
    const current = byName.get(candidate.name);
    if (!current || candidate.count < current.count) {
      byName.set(candidate.name, candidate);
    }
  }

  const nearest = [...byName.values()];
  const min = Math.min(...nearest.map((candidate) => candidate.count));
  const tied = nearest.filter((candidate) => candidate.count === min);

  if (remoteHead) {
    const preferred = tied.find((candidate) => candidate.name === remoteHead);
    if (preferred) return preferred.name;
  }

  tied.sort((a, b) => a.ref.localeCompare(b.ref));
  return tied[0].name;
}

/**
 * ベースブランチ（分岐元）を解決する。例外を投げず、常に何かを返す。
 * @param options - 解決オプション
 * @returns 解決結果（ブランチ名と根拠）
 */
export async function resolveBaseBranch(
  options: ResolveOptions = {},
): Promise<ResolvedBaseBranch> {
  try {
    return await resolveBaseBranchInternal(options);
  } catch {
    // 注入された実行関数が throw しても、ワークフローを停止させない
    return { baseBranch: FALLBACK_BASE_BRANCH, source: "fallback" };
  }
}

/**
 * 解決本体。
 * @param options - 解決オプション
 * @returns 解決結果（ブランチ名と根拠）
 */
async function resolveBaseBranchInternal(
  options: ResolveOptions,
): Promise<ResolvedBaseBranch> {
  const cwd = options.cwd ?? Deno.cwd();
  const run = options.run ?? defaultRunner;
  const allowGh = options.allowGh ?? true;

  // 0. 明示指定
  const explicit = sanitizeExplicitBase(options.explicitBase);
  if (explicit) return { baseBranch: explicit, source: "explicit" };

  const remotes = await detectRemotes(run, cwd);

  // 0.5 PRの宛先（事実）。PRが存在するなら推測より優先する
  const prBase = await detectPullRequestBase(run, cwd, remotes, options.fromPr);
  if (prBase) return { baseBranch: prBase, source: "pr-base" };

  const currentResult = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const currentBranch = currentResult.code === 0
    ? toBranchName(currentResult.stdout, remotes)
    : null;

  // 同点判定で使うため、判定順より早く取得しておく（採用順は下記のとおり）
  const remoteHead = await detectRemoteHead(run, cwd, remotes);

  // 1. 上流追跡ブランチ
  const upstream = await detectUpstream(run, cwd, remotes, currentBranch);
  if (upstream) return { baseBranch: upstream, source: "upstream" };

  // 2. 既定ブランチ上にいるなら、それが分岐元（fork point 探索は不要）
  if (currentBranch && remoteHead && currentBranch === remoteHead) {
    return { baseBranch: currentBranch, source: "remote-head" };
  }

  // 3. fork point が最も近いブランチ（リモート・ローカルの両方）
  const forkPoint = await detectForkPoint(run, cwd, remotes, currentBranch, remoteHead);
  if (forkPoint) return { baseBranch: forkPoint, source: "fork-point" };

  // 4. リモート既定ブランチ
  if (remoteHead) return { baseBranch: remoteHead, source: "remote-head" };

  // 5. GitHub の既定ブランチ
  if (allowGh) {
    const gh = await run(
      "gh",
      ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
      cwd,
    );
    const name = gh.code === 0 ? toBranchName(gh.stdout, remotes) : null;
    if (name) return { baseBranch: name, source: "github-default" };
  }

  // 6. init.defaultBranch
  const init = await run("git", ["config", "--get", "init.defaultBranch"], cwd);
  const initBranch = init.code === 0 ? toBranchName(init.stdout, remotes) : null;
  if (initBranch) return { baseBranch: initBranch, source: "init-default" };

  // 7. 最終フォールバック
  return { baseBranch: FALLBACK_BASE_BRANCH, source: "fallback" };
}

/**
 * CLI のメイン処理。常に exit 0 で結果を JSON 出力する。
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      string: ["cwd", "base", "from-pr"],
      alias: { b: "base" },
    });

    const resolved = await resolveBaseBranch({
      cwd: args.cwd,
      explicitBase: args.base,
      fromPr: args["from-pr"],
    });
    console.log(JSON.stringify(resolved));
  } catch (error) {
    // 解決できないことがワークフロー停止の理由になってはならない
    console.error(`[resolve_base_branch] ${String(error)}`);
    console.log(JSON.stringify({ baseBranch: FALLBACK_BASE_BRANCH, source: "fallback" }));
  }
  Deno.exit(0);
}

if (import.meta.main) {
  await main();
}
