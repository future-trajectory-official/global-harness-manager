import { executeCommand } from "./io/command.ts";
import { sprintId } from "../domain/types.ts";
import type { EntityScope, SprintIdentifier } from "../domain/types.ts";

export async function detectCurrentSprint(scope: EntityScope): Promise<SprintIdentifier> {
  const result = await executeCommand({
    cmd: "gh",
    args: [
      "api",
      `repos/${scope.owner}/${scope.repository}/milestones?state=open&sort=number&direction=desc&per_page=1`,
      "--jq",
      ".[0] | {number, title, node_id}",
    ],
  });
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
  return sprintId(scope, sprintNumber, milestone.node_id ?? undefined, String(milestone.number));
}

export function sprintNumberFrom(id: SprintIdentifier): number {
  const match = id.title.value.match(/^Sprint\s+(\d+)$/);
  if (!match) throw new Error(`Invalid sprint identifier title: "${id.title.value}"`);
  return parseInt(match[1], 10);
}
