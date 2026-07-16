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

interface RoleInfo {
  name: string;
  description: string;
}

interface SkillInfo {
  name: string;
  description: string;
  tags: string[];
  bundle: string;
}

function extractFrontmatter(text: string): Record<string, unknown> | null {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
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

function collectRoles(rootDir: string): RoleInfo[] {
  const rulesDir = `${rootDir}/.agents/rules`;
  const roles: RoleInfo[] = [];
  for (const entry of Deno.readDirSync(rulesDir)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    const role = parseRoleFrontmatter(`${rulesDir}/${entry.name}`);
    if (role) roles.push(role);
  }
  return roles;
}

function collectSkills(rootDir: string): SkillInfo[] {
  const skillsBase = `${rootDir}/.agents/skills/bundles`;
  const skills: SkillInfo[] = [];
  const walkDir = (dir: string): void => {
    for (const entry of Deno.readDirSync(dir)) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        walkDir(fullPath);
      } else if (entry.isFile && entry.name === "SKILL.md") {
        const skill = parseSkillFrontmatter(fullPath);
        if (skill) skills.push(skill);
      }
    }
  };
  walkDir(skillsBase);
  return skills;
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
    const roles = collectRoles(workspaceRoot);
    const skills = collectSkills(workspaceRoot);

    console.log(JSON.stringify({ vision, productGoal, roles, skills }, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
