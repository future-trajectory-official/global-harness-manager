import { parseArgs } from "@std/cli";

const WEIGHT_MAP: Record<string, number> = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5,
  XL: 8,
};

export interface SprintMetrics {
  sprintName: string;
  pbiCount: number;
  totalWeight: number;
  matchRate: number;
  mismatches: Array<{ id: string; estimated: string; actual: string }>;
  summary: string;
}

/** アーカイブファイルから指定スプリントの全PBIを解析し、ベロシティメトリクスを算出する */
export function parseSprintMetrics(
  archiveContent: string,
  sprintName: string,
): SprintMetrics {
  const pbiBlocks = extractPbiBlocksForSprint(archiveContent, sprintName);

  let totalWeight = 0;
  let matchedCount = 0;
  const mismatches: SprintMetrics["mismatches"] = [];

  for (const block of pbiBlocks) {
    const estimated = extractSize(block, "見積サイズ");
    const actual = extractSize(block, "実感サイズ");
    const id = extractPbiId(block);

    const weight = WEIGHT_MAP[estimated] ?? 0;
    totalWeight += weight;

    if (estimated === actual) {
      matchedCount++;
    } else {
      mismatches.push({ id, estimated, actual });
    }
  }

  const pbiCount = pbiBlocks.length;
  const matchRate = pbiCount > 0 ? matchedCount / pbiCount : 1;

  const summary = buildSummary(pbiCount, matchedCount, mismatches);

  return {
    sprintName,
    pbiCount,
    totalWeight,
    matchRate,
    mismatches,
    summary,
  };
}

/** アーカイブMarkdownから指定スプリントに属する全PBIブロックを抽出する */
function extractPbiBlocksForSprint(content: string, sprintName: string): string[] {
  const blocks: string[] = [];
  const lines = content.split("\n");
  let currentBlock: string[] = [];
  let inTargetSprint = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### [DONE]")) {
      if (inTargetSprint && currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n"));
      }
      currentBlock = [line];
      inTargetSprint = false;
    } else if (line.startsWith("### ") && currentBlock.length > 0) {
      if (inTargetSprint) {
        blocks.push(currentBlock.join("\n"));
      }
      currentBlock = [line];
      inTargetSprint = false;
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
      if (line.includes(`**スプリント**: ${sprintName}`)) {
        inTargetSprint = true;
      }
    }
  }

  if (inTargetSprint && currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n"));
  }

  return blocks;
}

/** PBIブロックから指定フィールド（見積サイズ/実感サイズ）の値を抽出する */
function extractSize(block: string, fieldName: string): string {
  const regex = new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(\\S+)`);
  const match = block.match(regex);
  return match ? match[1] : "";
}

/** PBIブロックからPBI識別子（[EpicID/FeatureID]/PBI名）を抽出する */
function extractPbiId(block: string): string {
  const match = block.match(/###\s+\[DONE\]\s+(\S+)/);
  return match ? match[1] : "";
}

/** 乖離状況から自然文のサマリーを生成する */
function buildSummary(
  pbiCount: number,
  matchedCount: number,
  mismatches: Array<{ id: string; estimated: string; actual: string }>,
): string {
  if (pbiCount === 0) return "";

  if (matchedCount === pbiCount) return "全一致";

  const parts: string[] = [];
  for (const m of mismatches) {
    const shortId = m.id.split("/").pop() || m.id;
    parts.push(`${shortId} が ${m.estimated}→${m.actual} に乖離`);
  }

  if (mismatches.length === 1 && pbiCount === 1) return parts[0];

  const rate = pbiCount > 0 ? `${matchedCount}/${pbiCount}一致` : "";
  return `${rate}（${parts.join("、")}）`;
}

/** メトリクスからスプリント実績推移テーブルの1行を生成する */
export function buildTableRow(metrics: SprintMetrics): string {
  const matchRateDisplay = metrics.matchRate === 1
    ? "全一致"
    : metrics.matchRate === 0
    ? "全乖離"
    : `${Math.round(metrics.matchRate * 100)}%一致`;

  return `| ${metrics.sprintName} | ${metrics.pbiCount} | ${metrics.totalWeight} | ${matchRateDisplay} | ${metrics.summary} |`;
}

/** スプリント実績推移テーブルに新規行を追記する。dryRun時は元の内容を変更せず返す */
export function updateBacklogFile(
  backlogContent: string,
  newRow: string,
  dryRun?: boolean,
): string {
  if (dryRun) return backlogContent;

  const tableHeaderRegex = /^(\|.*実感サイズ一致率.*\|.*備考.*\|)\n([\s\S]*?)(?=\n## |\n$)/m;
  const tableMatch = backlogContent.match(tableHeaderRegex);

  if (!tableMatch) return backlogContent + `\n${newRow}\n`;

  const tableSection = tableMatch[2];
  const updatedTable = tableSection.trimEnd() + `\n${newRow}\n`;
  return backlogContent.replace(tableMatch[2], updatedTable);
}

function main() {
  const args = parseArgs(Deno.args);
  const sprint = args.sprint as string | undefined;

  if (!sprint) {
    console.error(
      "Usage: deno run -A record_velocity.ts --sprint <sprint-name> [--dry-run]",
    );
    Deno.exit(1);
  }

  const archivePath = ".agents/management/product-backlog-archive.md";
  const backlogPath = ".agents/management/product-backlog.md";

  const archiveContent = Deno.readTextFileSync(archivePath);
  const backlogContent = Deno.readTextFileSync(backlogPath);

  const metrics = parseSprintMetrics(archiveContent, sprint);
  const row = buildTableRow(metrics);
  const dryRun = args["dry-run"] === true;

  if (dryRun) {
    console.log("--- DRY RUN: 追記される行 ---");
    console.log(row);
    console.log("--- ファイルは変更されていません ---");
    return;
  }

  const result = updateBacklogFile(backlogContent, row, false);
  Deno.writeTextFileSync(backlogPath, result);
  console.log(`Updated ${backlogPath} with sprint metrics for ${sprint}`);
}

if (import.meta.main) {
  main();
}
