/**
 * `.harnessrc` パスの解決ヘルパー。
 *
 * グローバル配布（`~/.harness`）したスクリプトは、スクリプト自身からの相対パスで
 * 呼出元リポジトリのローカル `.harnessrc` を参照できない（構造的制約）。
 * そのため複数候補（環境変数 → リポジトリルート直下 → 慣例パス → cwd 起点）から探索し、
 * 明示的授受を最優先とする方針で解決する（plan.md 設計判断3・PO合意済み）。
 *
 * 本モジュールは同期処理（`Deno.readTextFileSync` / `Deno.statSync`）で実装し、
 * `composition-root.ts` のモジュール初期化時（トップレベル）から呼び出せるようにする。
 * 探索候補と依存（env / cwd / exists）は関数引数で注入可能にし、純関数としてテスト可能にする。
 */
import { join } from "@std/path";

/** `.harnessrc` を探索する候補パスを列挙する。 */
export interface HarnessRcCandidates {
  /** 環境変数 `HARNESS_RC_PATH` による明示指定（最優先）。 */
  readonly envPath?: string;
  /** リポジトリルート（`HARNESS_WORKSPACE_ROOT` 相当）。 */
  readonly workspaceRoot?: string;
  /** 現在の作業ディレクトリ。 */
  readonly cwd: string;
}

/**
 * `.harnessrc` の候補パス一覧を優先順に構築する（純関数）。
 *
 * 探索順:
 * 1. `HARNESS_RC_PATH` 環境変数（明示的授受・最優先）
 * 2. リポジトリルート直下 `.harnessrc`
 * 3. リポジトリルート配下 `.github/schemas/.harnessrc`（従来の慣例パス）
 * 4. リポジトリルート配下 `config/.harnessrc`
 * 5. cwd 起点の各慣例パス（`.harnessrc` / `.github/schemas/.harnessrc` / `config/.harnessrc`）
 *
 * @param opts 候補構築に必要な入力（依存注入可能）
 * @returns 優先順の候補パス一覧（重複・空を除外）
 */
export function buildHarnessRcCandidates(opts: HarnessRcCandidates): string[] {
  const candidates: string[] = [];
  if (opts.envPath) {
    candidates.push(opts.envPath);
  }
  if (opts.workspaceRoot) {
    candidates.push(join(opts.workspaceRoot, ".harnessrc"));
    candidates.push(join(opts.workspaceRoot, ".github", "schemas", ".harnessrc"));
    candidates.push(join(opts.workspaceRoot, "config", ".harnessrc"));
  }
  candidates.push(join(opts.cwd, ".harnessrc"));
  candidates.push(join(opts.cwd, ".github", "schemas", ".harnessrc"));
  candidates.push(join(opts.cwd, "config", ".harnessrc"));

  // 空文字を除外し、重複を除去しつつ順序を保持する
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of candidates) {
    if (!p) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    unique.push(p);
  }
  return unique;
}

/**
 * `.harnessrc` の候補パスから最初に存在するパスを返す。存在しない場合は null。
 *
 * @param candidates 候補パス一覧（`buildHarnessRcCandidates` の出力）
 * @param exists 存在判定関数（テスト用に注入可能。既定は `Deno.statSync` ベース）
 * @returns 最初に存在する候補パス、または null
 */
export function findFirstExisting(
  candidates: string[],
  exists: (path: string) => boolean = (path) => {
    try {
      Deno.statSync(path);
      return true;
    } catch {
      return false;
    }
  },
): string | null {
  for (const path of candidates) {
    if (exists(path)) {
      return path;
    }
  }
  return null;
}

/**
 * 依存を既定値で注入し、`.harnessrc` パスを解決する（composition-root から呼ばれる入口）。
 *
 * @param deps 依存注入用オプション（既定: `Deno` 環境）
 * @returns 解決された `.harnessrc` パス、または null
 */
export function resolveHarnessRcPath(
  deps: {
    env: (key: string) => string | undefined;
    cwd: () => string;
    workspaceRoot: () => string | undefined;
    exists: (path: string) => boolean;
  } = {
    env: (key) => Deno.env.get(key),
    cwd: () => Deno.cwd(),
    workspaceRoot: () => Deno.env.get("HARNESS_WORKSPACE_ROOT"),
    exists: (path) => {
      try {
        Deno.statSync(path);
        return true;
      } catch {
        return false;
      }
    },
  },
): string | null {
  const candidates = buildHarnessRcCandidates({
    envPath: deps.env("HARNESS_RC_PATH"),
    workspaceRoot: deps.workspaceRoot(),
    cwd: deps.cwd(),
  });
  return findFirstExisting(candidates, deps.exists);
}

/** `.harnessrc` から読み取った設定切替情報（ボード番号・フィールド名）。 */
export interface HarnessRcConfig {
  /** ボード種別（productBacklog/sprintBoard/retrospectiveBoard）と番号の対応。 */
  readonly projects: Record<string, number>;
  /** harness-* フィールド名の対応。 */
  readonly fields: Record<string, string>;
}

/**
 * 解決済みパスから `.harnessrc` の設定切替情報を読み取る。
 *
 * 明示パス（`HARNESS_RC_PATH` 解決結果を含む）で指定されたファイルを読み、
 * JSON を解析して projects/fields を返す。composition-root の読込処理の
 * テスト可能な抽出であり、挙動は従来どおり（欠落時は空オブジェクト）。
 * 型に合わない値（非数値のボード番号・非文字列のフィールド名）は除外し、
 * projects/fields 自体がオブジェクトでない場合は空オブジェクトとする。
 *
 * @param path `resolveHarnessRcPath` の解決結果。null の場合は null を返す
 * @param readFile ファイル読込関数（テスト用に注入可能。既定は `Deno.readTextFileSync`）
 * @returns 設定切替情報。読込失敗・不正 JSON の場合は null
 */
export function loadHarnessRcConfig(
  path: string | null,
  readFile: (path: string) => string = Deno.readTextFileSync,
): HarnessRcConfig | null {
  if (!path) return null;
  try {
    const parsed: unknown = JSON.parse(readFile(path));
    return {
      projects: sanitizeNumberRecord(
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>).projects
          : undefined,
      ),
      fields: sanitizeStringRecord(
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>).fields
          : undefined,
      ),
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }
  return result;
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry;
    }
  }
  return result;
}
