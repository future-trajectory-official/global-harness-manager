import { executeCommand } from "./io/command.ts";
import type { ExecuteResult } from "./io/command.ts";
import { sprintId } from "../domain/types.ts";
import type { EntityScope, SprintIdentifier } from "../domain/types.ts";

export type SprintCommandRunner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

const defaultCommandRunner: SprintCommandRunner = (cmd, args) => executeCommand({ cmd, args });

/** git remote URL から owner/repository を解釈する。sshエイリアス（git@host-alias:owner/repo.git）にも対応。 */
export function parseScopeFromRemote(remoteUrl: string): EntityScope | null {
  const ssh = remoteUrl.match(/^git@[^:]+:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1], repository: ssh[2] };
  const https = remoteUrl.match(/^https?:\/\/[^/]+\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (https) return { owner: https[1], repository: https[2] };
  return null;
}

/** scope が未指定/unknown プレースホルダの場合、git remote origin から自動解決する。 */
export async function resolveScope(
  scope: EntityScope,
  runCommand: SprintCommandRunner = defaultCommandRunner,
): Promise<EntityScope> {
  if (
    scope.owner && scope.repository && scope.owner !== "unknown" &&
    scope.repository !== "unknown"
  ) {
    return scope;
  }
  const result = await runCommand("git", ["remote", "get-url", "origin"]);
  if (result.code !== 0) {
    throw new Error(`Failed to resolve scope from git remote: ${result.stderr}`);
  }
  const parsed = parseScopeFromRemote(result.stdout.trim());
  if (!parsed) {
    throw new Error(`Could not parse owner/repo from git remote: ${result.stdout.trim()}`);
  }
  return parsed;
}

export async function detectCurrentSprint(
  scope: EntityScope,
  runCommand: SprintCommandRunner = defaultCommandRunner,
): Promise<SprintIdentifier> {
  const resolved = await resolveScope(scope, runCommand);
  const result = await runCommand(
    "gh",
    [
      "api",
      `repos/${resolved.owner}/${resolved.repository}/milestones?state=open&sort=number&direction=desc&per_page=1`,
      "--jq",
      ".[0] | {number, title, node_id}",
    ],
  );
  if (result.code !== 0) {
    throw new Error(`Failed to detect current sprint from milestones: ${result.stderr}`);
  }
  let milestone: { number: number | null; title: string | null; node_id: string | null };
  try {
    milestone = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Failed to parse milestone response: ${result.stdout.substring(0, 200)}`,
    );
  }
  if (!milestone || milestone.title == null || milestone.number == null) {
    throw new Error("No open milestones found. Cannot detect current sprint.");
  }
  const sprintMatch = milestone.title.match(/^Sprint\s+(\d+)$/);
  if (!sprintMatch) {
    throw new Error(`Unexpected milestone title format: "${milestone.title}"`);
  }
  const sprintNumber = parseInt(sprintMatch[1], 10);
  return sprintId(resolved, sprintNumber, milestone.node_id ?? undefined, String(milestone.number));
}

export function sprintNumberFrom(id: SprintIdentifier): number {
  const match = id.title.value.match(/^Sprint\s+(\d+)$/);
  if (!match) throw new Error(`Invalid sprint identifier title: "${id.title.value}"`);
  return parseInt(match[1], 10);
}
