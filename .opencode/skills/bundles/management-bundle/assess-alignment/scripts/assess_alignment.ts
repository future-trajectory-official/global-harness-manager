#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import { productGoalUseCase } from "../../../../../core/domain/product-goal-usecase.ts";
import { executeRawPlan } from "../../../../../core/composition-root.ts";
import type { ExecutionResult, Plan, StepResult } from "../../../../../core/domain/types.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";

function getStepResult(
  plan: Plan,
  result: ExecutionResult,
  entity: string,
  operation: string,
): StepResult | undefined {
  const idx = plan.steps.findIndex(
    (s) => s.entity === entity && s.operation === operation,
  );
  return idx >= 0 ? result.stepResults[idx] : undefined;
}

/**
 * ロール定義（エージェント persona の name/description）。
 */
export interface RoleInfo {
  /** ロール名（frontmatterのname、無ければファイルbasename） */
  name: string;
  /** ロールの説明文 */
  description: string;
}

/**
 * スキル定義（SKILL.md の name/description/tags/bundle）。
 */
export interface SkillInfo {
  /** スキル名（frontmatterのname必須） */
  name: string;
  /** スキルの説明文 */
  description: string;
  /** frontmatterのtags（単行 `[a, b]` 形式のみ対応） */
  tags: string[];
  /** 所属バンドル名（.opencode系は3階層上、他は直親ディレクトリ名） */
  bundle: string;
}

/**
 * Markdown先頭のYAML風frontmatterを単行 `key: value` 形式で抽出する。
 * 複数行リスト（`- item` 形式）には対応せず無視する。
 * @param text Markdown全文
 * @returns パースしたfrontmatter、存在しなければnull
 */
export function extractFrontmatter(text: string): Record<string, unknown> | null {
  const match = text.match(/^---\s*\n([\s\S]*?)(?=\n---|\n\.\.\.|\s*$)/);
  if (!match) return null;
  const frontmatter: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const eqIdx = line.indexOf(":");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value.slice(1, -1).split(",").map((s) =>
        s.trim().replace(/^['"]|['"]$/g, "")
      );
    } else if (value.startsWith('"') && value.endsWith('"')) {
      frontmatter[key] = value.slice(1, -1);
    } else {
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

function parseRoleFrontmatter(filePath: string): RoleInfo | null {
  const text = Deno.readTextFileSync(filePath);
  const fm = extractFrontmatter(text);
  if (!fm) return null;
  const basename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
  return {
    name: fm.name ? String(fm.name) : basename,
    description: String(fm.description ?? ""),
  };
}

function parseSkillFrontmatter(filePath: string): SkillInfo | null {
  const text = Deno.readTextFileSync(filePath);
  const fm = extractFrontmatter(text);
  if (!fm || !fm.name) return null;
  const parts = filePath.split("/");
  const bundle = parts[parts.length - 3] ?? "";
  return {
    name: String(fm.name),
    description: String(fm.description ?? ""),
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    bundle,
  };
}

/**
 * ディレクトリの存在確認を行う。
 * @param path 確認対象のパス
 * @returns ディレクトリとして存在すればtrue
 */
export function dirExists(path: string): boolean {
  try {
    return Deno.statSync(path).isDirectory;
  } catch {
    return false;
  }
}

/**
 * 単一ディレクトリからロール定義を収集する。不在・読取失敗時は警告を出して空配列で継続する。
 * @param rolesDir ロール定義(.md)を格納するディレクトリ
 * @returns 収集したロール一覧（失敗時は空配列）
 */
export function collectRoles(rolesDir: string): RoleInfo[] {
  if (!dirExists(rolesDir)) {
    console.error(`[assess-alignment] warn: skip missing roles dir: ${rolesDir}`);
    return [];
  }
  const roles: RoleInfo[] = [];
  try {
    for (const entry of Deno.readDirSync(rolesDir)) {
      if (!entry.isFile || !entry.name.endsWith(".md")) continue;
      try {
        const role = parseRoleFrontmatter(`${rolesDir}/${entry.name}`);
        if (role) roles.push(role);
      } catch (e) {
        console.error(
          `[assess-alignment] warn: skip unreadable role file: ${rolesDir}/${entry.name}: ${
            (e as Error).message
          }`,
        );
      }
    }
  } catch (e) {
    console.error(
      `[assess-alignment] warn: failed to read roles dir: ${rolesDir}: ${(e as Error).message}`,
    );
    return [];
  }
  return roles;
}

/**
 * ワークスペース配下のロール候補パス一覧を返す。優先順位: opencode → claudecode。
 * workspace直下の `.agents/agents` は対象外（B案PO決定。Antigravityカスタムエージェントは実測不使用のため別PBI化）。
 * @param workspaceRoot 呼出元リポジトリのルート
 * @returns 存在確認順の候補ディレクトリ一覧
 */
export function roleCandidateDirs(workspaceRoot: string): string[] {
  return [
    `${workspaceRoot}/.opencode/agents`,
    `${workspaceRoot}/.claude/agents`,
  ];
}

/**
 * HOMEディレクトリを解決する。
 * @param homeDir 明示指定のHOME（テスト用に注入可、省略時は環境変数）
 * @returns HOMEパス、不在時は空文字
 */
export function resolveHomeDir(homeDir?: string): string {
  return homeDir ?? Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "";
}

/**
 * グローバル配置のロールディレクトリを返す。HOME不在時は空配列。
 * @param homeDir HOMEディレクトリ（省略時はDeno.envから取得）
 * @returns グローバル候補ディレクトリ一覧
 */
export function globalRoleDirs(homeDir?: string): string[] {
  const home = resolveHomeDir(homeDir);
  if (!home) return [];
  return [`${home}/.harness/agents`];
}

/**
 * ワークスペース＋グローバルの候補パスからロールを収集する。同名は優先順位先勝＋警告記録。
 * @param workspaceRoot 呼出元リポジトリのルート
 * @param homeDir HOMEディレクトリ（テスト用に注入可、省略時は環境変数）
 * @returns roles収集結果とwarnings警告一覧
 */
export function collectRolesFromWorkspace(
  workspaceRoot: string,
  homeDir?: string,
): { roles: RoleInfo[]; warnings: string[] } {
  const roles: RoleInfo[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const candidates = [...roleCandidateDirs(workspaceRoot), ...globalRoleDirs(homeDir)];
  let foundAnyDir = false;
  for (const dir of candidates) {
    if (!dirExists(dir)) {
      warnings.push(`skip missing roles dir: ${dir}`);
      continue;
    }
    foundAnyDir = true;
    for (const role of collectRoles(dir)) {
      if (seen.has(role.name)) {
        warnings.push(`duplicate role skipped (first-wins): ${role.name} in ${dir}`);
        continue;
      }
      seen.add(role.name);
      roles.push(role);
    }
  }
  if (!foundAnyDir) warnings.push("no roles dir found in workspace or global");
  return { roles, warnings };
}

/**
 * 単一ディレクトリを再帰走査してSKILL.mdを収集する。不在・読取失敗時は警告を出して空配列で継続する。
 * @param baseDir 走査起点ディレクトリ
 * @returns 収集したスキル一覧（失敗時は空配列）
 */
export function collectSkillsRecursive(baseDir: string): SkillInfo[] {
  if (!dirExists(baseDir)) {
    console.error(`[assess-alignment] warn: skip missing skills dir: ${baseDir}`);
    return [];
  }
  const skills: SkillInfo[] = [];
  const walkDir = (dir: string): void => {
    let entries;
    try {
      entries = Deno.readDirSync(dir);
    } catch (e) {
      console.error(
        `[assess-alignment] warn: failed to read skills dir: ${dir}: ${(e as Error).message}`,
      );
      return;
    }
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        walkDir(fullPath);
      } else if (entry.isFile && entry.name === "SKILL.md") {
        try {
          const skill = parseSkillFrontmatter(fullPath);
          if (skill) skills.push(skill);
        } catch (e) {
          console.error(
            `[assess-alignment] warn: skip unreadable skill file: ${fullPath}: ${
              (e as Error).message
            }`,
          );
        }
      }
    }
  };
  walkDir(baseDir);
  return skills;
}

/**
 * SKILL.mdのfrontmatter読取を試み、失敗時はnullを返す。
 * @param filePath SKILL.mdのパス
 * @returns frontmatterまたはnull
 */
function tryReadFrontmatter(filePath: string): Record<string, unknown> | null {
  try {
    return extractFrontmatter(Deno.readTextFileSync(filePath));
  } catch {
    return null;
  }
}

/**
 * 単一ディレクトリの直下1段を走査してSKILL.mdを収集する（Codex/Claude配置用）。
 * @param baseDir 走査起点ディレクトリ
 * @returns 収集したスキル一覧（失敗時は空配列）
 */
export function collectSkillsShallow(baseDir: string): SkillInfo[] {
  if (!dirExists(baseDir)) {
    console.error(`[assess-alignment] warn: skip missing skills dir: ${baseDir}`);
    return [];
  }
  const skills: SkillInfo[] = [];
  try {
    for (const entry of Deno.readDirSync(baseDir)) {
      if (!entry.isDirectory) continue;
      const skillFile = `${baseDir}/${entry.name}/SKILL.md`;
      const fm = tryReadFrontmatter(skillFile);
      if (!fm || !fm.name) {
        if (fileExists(skillFile)) {
          console.error(`[assess-alignment] warn: skip skill without name: ${skillFile}`);
        }
        continue;
      }
      skills.push({
        name: String(fm.name),
        description: String(fm.description ?? ""),
        tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
        bundle: entry.name,
      });
    }
  } catch (e) {
    console.error(
      `[assess-alignment] warn: failed to read skills dir: ${baseDir}: ${(e as Error).message}`,
    );
    return [];
  }
  return skills;
}

/**
 * ファイルの存在確認を行う。
 * @param path 確認対象のパス
 * @returns ファイルとして存在すればtrue
 */
export function fileExists(path: string): boolean {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
}

/**
 * グローバル配置のスキルバンドルディレクトリを返す。HOME不在時は空配列。
 * @param homeDir HOMEディレクトリ（省略時はDeno.envから取得）
 * @returns グローバル候補ディレクトリ一覧
 */
export function globalSkillsBundleDirs(homeDir?: string): string[] {
  const home = resolveHomeDir(homeDir);
  if (!home) return [];
  return [`${home}/.harness/skills/bundles`];
}

/**
 * ワークスペース＋グローバルの候補パスからスキルを収集する。同名は優先順位先勝＋警告記録。
 * 優先順位: ワークスペース系を全て先に（.opencode再帰 → .claude1段 → .agents1段）、グローバル再帰は最後。
 * @param workspaceRoot 呼出元リポジトリのルート
 * @param homeDir HOMEディレクトリ（テスト用に注入可、省略時は環境変数）
 * @returns skills収集結果とwarnings警告一覧
 */
export function collectSkillsFromWorkspace(
  workspaceRoot: string,
  homeDir?: string,
): { skills: SkillInfo[]; warnings: string[] } {
  const skills: SkillInfo[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const pushAll = (found: SkillInfo[], dir: string) => {
    for (const skill of found) {
      if (seen.has(skill.name)) {
        warnings.push(`duplicate skill skipped (first-wins): ${skill.name} in ${dir}`);
        continue;
      }
      seen.add(skill.name);
      skills.push(skill);
    }
  };
  const candidates: { dir: string; strategy: "recursive" | "shallow" }[] = [
    { dir: `${workspaceRoot}/.opencode/skills/bundles`, strategy: "recursive" },
    { dir: `${workspaceRoot}/.claude/skills`, strategy: "shallow" },
    { dir: `${workspaceRoot}/.agents/skills`, strategy: "shallow" },
    ...globalSkillsBundleDirs(homeDir).map((dir) => ({ dir, strategy: "recursive" as const })),
  ];
  let foundAnyDir = false;
  for (const { dir, strategy } of candidates) {
    if (!dirExists(dir)) {
      warnings.push(`skip missing skills dir: ${dir}`);
      continue;
    }
    foundAnyDir = true;
    pushAll(
      strategy === "recursive" ? collectSkillsRecursive(dir) : collectSkillsShallow(dir),
      dir,
    );
  }
  if (!foundAnyDir) warnings.push("no skills dir found in workspace or global");
  return { skills, warnings };
}

/**
 * ローカル能力収集の結果（ロール・スキル・警告）。
 */
export interface LocalCollection {
  /** 収集したロール一覧 */
  roles: RoleInfo[];
  /** 収集したスキル一覧 */
  skills: SkillInfo[];
  /** 収集中の警告（不在スキップ・重複・失敗継続） */
  warnings: string[];
}

/**
 * ローカル能力収集を分離実行する。片方の収集が異常終了してももう片方を道連れにせず、
 * 空配列＋警告で継続する（部分成功）。
 * @param workspaceRoot 呼出元リポジトリのルート
 * @param homeDir HOMEディレクトリ（テスト用に注入可、省略時は環境変数）
 * @param roleCollector ロール収集関数（テスト用に注入可）
 * @param skillCollector スキル収集関数（テスト用に注入可）
 * @returns ロール・スキル・警告をまとめた収集結果
 */
export function collectLocalCapabilities(
  workspaceRoot: string,
  homeDir?: string,
  roleCollector: typeof collectRolesFromWorkspace = collectRolesFromWorkspace,
  skillCollector: typeof collectSkillsFromWorkspace = collectSkillsFromWorkspace,
): LocalCollection {
  const out: LocalCollection = { roles: [], skills: [], warnings: [] };
  try {
    const r = roleCollector(workspaceRoot, homeDir);
    out.roles = r.roles;
    out.warnings.push(...r.warnings);
  } catch (e) {
    out.warnings.push(
      `local roles collection failed, continuing with empty roles: ${errorUtil.toError(e).message}`,
    );
  }
  try {
    const s = skillCollector(workspaceRoot, homeDir);
    out.skills = s.skills;
    out.warnings.push(...s.warnings);
  } catch (e) {
    out.warnings.push(
      `local skills collection failed, continuing with empty skills: ${
        errorUtil.toError(e).message
      }`,
    );
  }
  return out;
}

/**
 * 部分成功JSONの出力形式。
 */
export interface AlignmentOutput {
  /** GitHubから取得したビジョン情報 */
  vision: VisionData;
  /** GitHubから取得したプロダクトゴール情報（未設定時はnull） */
  productGoal: ProductGoalData | null;
  /** 収集したロール一覧 */
  roles: RoleInfo[];
  /** 収集したスキル一覧 */
  skills: SkillInfo[];
  /** 収集中の警告（部分成功の証跡） */
  warnings: string[];
}

/**
 * GitHub取得分とローカル収集分を部分成功JSONとして組み立てる。
 * @param vision GitHubから取得したビジョン情報
 * @param productGoal GitHubから取得したプロダクトゴール情報（未設定時はnull）
 * @param local ローカル能力収集の結果
 * @returns 出力JSONオブジェクト
 */
export function buildAlignmentOutput(
  vision: VisionData,
  productGoal: ProductGoalData | null,
  local: LocalCollection,
): AlignmentOutput {
  return {
    vision,
    productGoal,
    roles: local.roles,
    skills: local.skills,
    warnings: local.warnings,
  };
}

function extractVisionFromComments(comments: Array<{ body?: string }>): {
  targetAudience: string;
  value: string;
  differentiator: string;
  outcomes: { title: string; description: string }[];
} | null {
  if (!comments || comments.length === 0) return null;
  const latest = comments[comments.length - 1];
  const body = latest.body ?? "";

  const extractSection = (heading: string): string => {
    const re = new RegExp(`###\\s*${heading}\\s*\\n\\n([\\s\\S]*?)(?:\\n###|\\n##|$)`);
    const m = body.match(re);
    return m ? m[1].trim() : "";
  };

  const targetAudience = extractSection("Target");
  const value = extractSection("Value");
  const differentiator = extractSection("Differentiator");

  const outcomes: { title: string; description: string }[] = [];
  const afterOutcomeHeading = body.match(/## Outcome\s*\n([\s\S]*)/);
  if (afterOutcomeHeading) {
    const outcomeSection = afterOutcomeHeading[1];
    const outcomeRe = /### ([^\n]+)\n\n([\s\S]*?)(?=\n### |\n##|$)/g;
    let m: RegExpExecArray | null;
    while ((m = outcomeRe.exec(outcomeSection)) !== null) {
      outcomes.push({ title: m[1].trim(), description: m[2].trim() });
    }
  }

  return { targetAudience, value, differentiator, outcomes };
}

async function fetchVisionFromGitHub(
  scope: EntityScope,
  repoTitle: string,
): Promise<VisionData> {
  const searchPlan = visionUseCase.find(identify(scope, repoTitle));
  const searchResult = await visionUseCase.executePlan(searchPlan);
  const searchOutput = getStepResult(searchPlan, searchResult, "Vision", "search")?.output as
    | Array<{ number: number }>
    | undefined;
  const visionNumber = searchOutput?.[0]?.number;
  if (!visionNumber) {
    console.error("No Vision issue found in repository");
    Deno.exit(1);
  }

  const viewIdentifier = identify(scope, repoTitle, undefined, String(visionNumber));
  const viewPlan = visionUseCase.find(viewIdentifier);
  const viewResult = await visionUseCase.executePlan(viewPlan);
  const viewOutput = getStepResult(viewPlan, viewResult, "Vision", "view")?.output as
    | Record<string, unknown>
    | undefined;
  if (!viewOutput) {
    console.error("Failed to fetch Vision issue details");
    Deno.exit(1);
  }

  const comments = viewOutput.comments as Array<{ body?: string }> | undefined;
  const vision = extractVisionFromComments(comments ?? []);
  if (!vision) {
    console.error("No Vision data found in issue comments");
    Deno.exit(1);
  }
  return vision;
}

type VisionData = NonNullable<ReturnType<typeof extractVisionFromComments>>;

interface ProductGoalData {
  description: string;
  version: number;
}

/**
 * ProductGoal Issue のコメントからゴール情報を抽出する。
 * コメント形式: "# Version: N\n\n## Goal\n\n[description]"
 */
function extractProductGoalFromComments(
  comments: Array<{ body?: string }>,
): ProductGoalData | null {
  if (!comments || comments.length === 0) return null;
  const latest = comments[comments.length - 1];
  const body = latest.body ?? "";

  const versionMatch = body.match(/^#\s*Version:\s*(\d+)/m);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : 1;

  const goalMatch = body.match(/##\s*Goal\s*\n\n([\s\S]*?)(?:\n##|$)/);
  const description = goalMatch ? goalMatch[1].trim() : "";

  if (!description) return null;
  return { description, version };
}

/**
 * GitHub から ProductGoal Issue を検索・取得する。
 * ProductGoal が存在しない場合は null を返す（エラーにしない）。
 */
async function fetchProductGoalFromGitHub(
  scope: EntityScope,
): Promise<ProductGoalData | null> {
  const searchPlan = {
    summary: "Search product goal",
    steps: [{
      entity: "ProductGoal" as const,
      operation: "search" as const,
      params: { labelType: "ProductGoal" },
    }],
  };
  const searchResult = await executeRawPlan(searchPlan);
  const searchOutput = getStepResult(searchPlan, searchResult, "ProductGoal", "search")?.output as
    | Array<{ number: number }>
    | undefined;
  const goalNumber = searchOutput?.[0]?.number;
  if (!goalNumber) {
    return null;
  }

  const goalTitle = `Product Goal of ${scope.repository}`;
  const viewIdentifier = identify(scope, goalTitle, "pending", String(goalNumber));
  const viewPlan = productGoalUseCase.find(viewIdentifier);
  const viewResult = await productGoalUseCase.executePlan(viewPlan);
  const viewOutput = getStepResult(viewPlan, viewResult, "ProductGoal", "view")?.output as
    | Record<string, unknown>
    | undefined;
  if (!viewOutput) {
    return null;
  }

  const comments = viewOutput.comments as Array<{ body?: string }> | undefined;
  return extractProductGoalFromComments(comments ?? []);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const scope: EntityScope = { owner: "unknown", repository: "unknown" };
    const repoTitle = `Vision of ${scope.repository}`;

    const searchPlan = visionUseCase.find(identify(scope, repoTitle));

    if (args["dry-run"]) {
      const dryViewPlan = visionUseCase.find(identify(scope, repoTitle, "<itemId>"));
      const productGoalSearchStep = {
        entity: "ProductGoal" as const,
        operation: "search" as const,
        params: { labelType: "ProductGoal" },
      };
      const productGoalViewStep = {
        entity: "ProductGoal" as const,
        operation: "view" as const,
        params: { itemId: "<itemId>" },
      };
      console.log(JSON.stringify(
        {
          summary: "assess-alignment",
          steps: [
            ...searchPlan.steps,
            ...dryViewPlan.steps,
            productGoalSearchStep,
            productGoalViewStep,
          ],
        },
        null,
        2,
      ));
      return;
    }

    const vision = await fetchVisionFromGitHub(scope, repoTitle);
    const productGoal = await fetchProductGoalFromGitHub(scope);

    const workspaceRoot = Deno.env.get("HARNESS_WORKSPACE_ROOT") ?? Deno.cwd();
    const local = collectLocalCapabilities(workspaceRoot);
    for (const w of local.warnings) {
      console.error(`[assess-alignment] warn: ${w}`);
    }

    console.log(JSON.stringify(buildAlignmentOutput(vision, productGoal, local), null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
