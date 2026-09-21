import { parseArgs } from "@std/cli/parse-args";
import { errorUtil, fsUtil, logger, pathUtil } from "../../../../../core/harness-core.ts";

/**
 * WP_2 #749: グローバル接続設定と検証。
 * 配布済みハーネス資産（既定 `~/.harness/`）を OpenCode のグローバル環境へ接続する。
 * 具体的には以下の設定を冪等に適用する（PO合意: 既存の model/provider/permission.bash は保持）。
 *
 * - `OPENCODE_CONFIG_DIR=~/.harness`（agents/commands を自動検出）をシェル設定へ冪等追記。
 * - `~/.config/opencode/opencode.jsonc` へ `skills`/`instructions`/`permission.skill` を追加マージ。
 *
 * 【設計方針】配布（`distribute-harness.ts`）とは責務を分離し、本スクリプトは「接続設定の適用」に専念する。
 * 適用先はホストのグローバル設定であるため、`--dry-run` で安全に試行できるようにする。
 */

/** 配布先の既定値（distribute-harness.ts と一致させる）。 */
export const DEFAULT_HARNESS_HOME = "~/.harness";
/** グローバル OpenCode 設定ディレクトリ。 */
export const GLOBAL_CONFIG_DIR = "~/.config/opencode";
/** グローバル設定ファイル名（既存拡張子 .jsonc を尊重）。 */
export const GLOBAL_CONFIG_FILE = "opencode.jsonc";
/** スキル配置ディレクトリ名。 */
export const SKILLS_DIR = "skills";
/** context 配置ディレクトリ名。 */
export const CONTEXT_DIR = "context";
/** 接続設定で設定する環境変数名。 */
export const OPENCODE_CONFIG_DIR_VAR = "OPENCODE_CONFIG_DIR";
/** グローバルで非表示化（deny）する配布・セットアップ系スキル（変換後 `global-*` 名）。 */
export const GLOBAL_DENY_SKILLS = [
  "global-publish-harness-skills",
  "global-publish-harness-rules",
  "global-harness-clone",
  "global-harness-init",
  "global-manage-git-identity",
  "global-attach-harness-to-project",
  "global-setup-harness-env",
  "global-check-harness-configs",
] as const;

/** JSONC のコメントを除去する（行コメント・ブロックコメント・末尾カンマ）。 */
export function stripJsoncComments(text: string): string {
  let out = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i++;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    // 末尾カンマ除去（文字列外のみ・M2対応）。`},` / `,]` のカンマと続く空白をスキップするが、
    // 文字列リテラル内の `,}` / `,]` は破壊しない。
    if (c === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") {
        i = j - 1; // 次のループで閉じ括弧を処理する
        continue;
      }
    }
    out += c;
  }
  return out;
}

/** 接続設定の追加分（マージ対象）を組み立てる。 */
export function buildConnectionConfig(
  harnessHome: string,
): { skills: string[]; instructions: string[]; permission: { skill: Record<string, string> } } {
  return {
    skills: [`${harnessHome}/${SKILLS_DIR}`],
    instructions: [`${harnessHome}/${CONTEXT_DIR}/*.md`, `${harnessHome}/AGENTS.md`],
    permission: {
      skill: Object.fromEntries(GLOBAL_DENY_SKILLS.map((name) => [name, "deny"])),
    },
  };
}

/**
 * 既存設定に接続設定をマージする。既存キー（model/provider/permission.bash 等）は保持し、
 * `skills`/`instructions` は上書き、`permission.skill` は既存の permission を壊さず追加する。
 * @param existing - 既存のグローバル設定
 * @param addition - `buildConnectionConfig` の出力
 * @returns マージ後の設定オブジェクト
 */
export function mergeConfig(
  existing: Record<string, unknown>,
  addition: {
    skills: string[];
    instructions: string[];
    permission: { skill: Record<string, string> };
  },
): Record<string, unknown> {
  const existingPermission = (existing.permission && typeof existing.permission === "object")
    ? { ...(existing.permission as Record<string, unknown>) }
    : {};
  // 既存 permission.skill（利用者設定の allow/ask 等）を保持しつつ、deny を追加マージする（M1対応）。
  const existingSkill =
    (existingPermission["skill"] && typeof existingPermission["skill"] === "object")
      ? { ...(existingPermission["skill"] as Record<string, unknown>) }
      : {};
  existingPermission["skill"] = { ...existingSkill, ...addition.permission.skill };
  return {
    ...existing,
    skills: addition.skills,
    instructions: addition.instructions,
    permission: existingPermission,
  };
}

/** グローバル設定ファイルを読み込む（未存在なら空オブジェクト）。 */
export async function readGlobalConfig(filePath: string): Promise<Record<string, unknown>> {
  if (!(await fsUtil.exists(filePath))) {
    return {};
  }
  const text = await fsUtil.readTextFile(filePath);
  return JSON.parse(stripJsoncComments(text)) as Record<string, unknown>;
}

/** グローバル設定ファイルを書き込む。 */
export async function writeGlobalConfig(
  filePath: string,
  config: Record<string, unknown>,
  dryRun: boolean,
): Promise<void> {
  // M4: 既に同一内容なら書き換えず、ユーザーのコメント・書式を保持する（冪等）。
  if (await fsUtil.exists(filePath)) {
    const currentRaw = await fsUtil.readTextFile(filePath);
    let current: Record<string, unknown>;
    try {
      current = JSON.parse(stripJsoncComments(currentRaw)) as Record<string, unknown>;
    } catch {
      current = {};
    }
    if (JSON.stringify(current) === JSON.stringify(config)) {
      logger.info(`Global config unchanged (skip write): ${filePath}`);
      return;
    }
  }
  const content = JSON.stringify(config, null, 2) + "\n";
  await fsUtil.writeTextFile(filePath, content, dryRun);
  logger.info(`Global config ${dryRun ? "(dry-run) " : ""}written: ${filePath}`);
}

/** 環境変数設定行を組み立てる。 */
export function buildShellEnvLine(varName: string, value: string): string {
  return `export ${varName}="${value}"`;
}

/**
 * シェル設定へ環境変数を冪等に追記する。対象プロファイル（.bashrc/.zshrc/.profile）のうち
 * 既に設定行が存在するものはスキップし、未設定なら追記する。対象が存在しない場合は .profile へ追記する。
 * @param varName - 環境変数名
 * @param value - 値
 * @param homeDir - ホームディレクトリ
 * @param dryRun - true の場合は追記せずログのみ
 * @returns 適用（または適用予定）したプロファイルパス一覧
 */
export async function applyShellEnv(
  varName: string,
  value: string,
  homeDir: string,
  dryRun: boolean,
): Promise<string[]> {
  const line = buildShellEnvLine(varName, value);
  const candidates = [".bashrc", ".zshrc", ".profile"];
  const profiles = candidates.map((f) => pathUtil.joinPath(homeDir, f));
  const existingProfiles: string[] = [];
  for (const profile of profiles) {
    if (await fsUtil.exists(profile)) {
      existingProfiles.push(profile);
    }
  }
  const targets = existingProfiles.length > 0
    ? existingProfiles
    : [pathUtil.joinPath(homeDir, ".profile")];
  const applied: string[] = [];
  for (const profile of targets) {
    const content = (await fsUtil.exists(profile)) ? await fsUtil.readTextFile(profile) : "";
    if (content.includes(line)) {
      logger.info(`Shell env already set in ${profile}. Skipping (idempotent).`);
      continue;
    }
    if (dryRun) {
      logger.dryRun(`Append to ${profile}: ${line}`);
    } else {
      await fsUtil.writeTextFile(
        profile,
        content.endsWith("\n") ? content + line + "\n" : content + "\n" + line + "\n",
      );
      logger.info(`Appended to ${profile}: ${line}`);
    }
    applied.push(profile);
  }
  return applied;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      string: ["harness-home", "config-dir", "config-file", "shell-home"],
      boolean: ["dry-run", "force"],
      alias: { d: "dry-run", f: "force" },
      default: {
        "harness-home": DEFAULT_HARNESS_HOME,
        "config-dir": GLOBAL_CONFIG_DIR,
        "config-file": GLOBAL_CONFIG_FILE,
      },
    });
    const isDryRun = args["dry-run"] || false;
    const harnessHome = pathUtil.expandHome(String(args["harness-home"]));
    const configDir = pathUtil.expandHome(String(args["config-dir"]));
    const configFile = pathUtil.expandHome(String(args["config-file"]));
    const shellHomeRaw = args["shell-home"];
    const homeDir = shellHomeRaw
      ? pathUtil.expandHome(String(shellHomeRaw))
      : (Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || pathUtil.expandHome("~"));

    logger.info(`Connect harness globally: ${harnessHome}`);
    logger.info(`Global config file: ${pathUtil.joinPath(configDir, configFile)}`);

    const configPath = pathUtil.joinPath(configDir, configFile);
    const existing = await readGlobalConfig(configPath);
    const addition = buildConnectionConfig(harnessHome);
    const merged = mergeConfig(existing, addition);
    await writeGlobalConfig(configPath, merged, isDryRun);

    logger.info(`Setting ${OPENCODE_CONFIG_DIR_VAR} in shell profiles...`);
    await applyShellEnv(OPENCODE_CONFIG_DIR_VAR, harnessHome, homeDir, isDryRun);

    logger.success("Global harness connection config applied.");
  } catch (e) {
    errorUtil.fatal(e, "Connect Harness Main");
  }
}

if (import.meta.main) {
  main();
}
