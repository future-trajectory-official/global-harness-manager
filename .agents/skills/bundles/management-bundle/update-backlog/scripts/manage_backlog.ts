import { parseArgs } from "@std/cli";

/**
 * manage_backlog.ts
 * 
 * バックログアイテムのアーカイブ処理を自動化するスクリプト。
 * AI 間の JSON インターフェースを前提とし、正確な抽出と構造的なアーカイブを実現する。
 */

export interface BacklogData {
  id: string;
  insights: string;
  tags: string[];
  metrics: { turns: number; sessions: number };
  outcomes: string[];
  summary?: string;
  acStatus?: string;
}

const BACKLOG_PATH = ".agents/management/product-backlog.md";
const ARCHIVE_PATH = ".agents/management/product-backlog-archive.md";

export function extractPbiBlock(content: string, pbiId: string): { block: string; regex: RegExp } {
  const escapedId = pbiId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`### \\[(?:DONE|WIP|TODO)\\] ${escapedId}[\\s\\S]*?(?=\\n###|$)`);
  const match = content.match(regex);
  if (!match) throw new Error(`PBI not found: ${pbiId}`);
  return { block: match[0], regex };
}

export function transformToArchiveCard(data: BacklogData, pbiBlock: string): string {
  const lines = pbiBlock.split("\n");
  
  // 概要の抽出
  const summaryLine = lines.find(l => l.includes("**概要**:"));
  const summary = data.summary || (summaryLine ? summaryLine.split("**概要**:")[1].trim() : "N/A");
  
  // AC の抽出
  const acHeaderIndex = lines.findIndex(l => l.includes("**受け入れ基準 (AC)**:"));
  let acStatus = "N/A";
  if (acHeaderIndex !== -1) {
    const acLines = [];
    for (let i = acHeaderIndex + 1; i < lines.length; i++) {
      if (lines[i].includes("- **") || lines[i].startsWith("###")) break;
      if (lines[i].trim()) acLines.push(lines[i]);
    }
    acStatus = acLines.length > 0 ? acLines.join("\n").trim() : "N/A";
  }
  if (data.acStatus) acStatus = data.acStatus;

  const today = new Date().toISOString().split("T")[0];
  const tagsStr = data.tags.join(" ");
  const metricsStr = `${data.metrics.turns} ターン / ${data.metrics.sessions} セッション`;

  return `
### [DONE] ${data.id}

- **完了日**: ${today}
- **見積り → 実績**: TODO → ${metricsStr}
- **当初の概要**: ${summary}
- **実際の成果物**:
${data.outcomes.map(o => `  ${o}`).join("\n")}
- **判明した知見・教訓**:
  ${tagsStr}
  ${data.insights}
- **受け入れ基準の達成状況**:
  ${acStatus.split("\n").map(line => line.trim()).join("\n  ")}
`;
}

export function updateContents(backlogContent: string, archiveContent: string, pbiRegex: RegExp, archiveCard: string): { newBacklog: string; newArchive: string } {
  const newBacklog = backlogContent.replace(pbiRegex, "").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  
  const anchor = "## 完了済みアイテム";
  const anchorIndex = archiveContent.indexOf(anchor);
  if (anchorIndex === -1) throw new Error("Anchor '## 完了済みアイテム' not found.");

  const insertPosition = anchorIndex + anchor.length;
  const newArchive = 
    archiveContent.slice(0, insertPosition) + 
    "\n" + archiveCard + 
    archiveContent.slice(insertPosition);

  return { newBacklog, newArchive };
}

async function main() {
  const args = parseArgs(Deno.args);
  const dataRaw = args.data;

  if (!dataRaw) {
    console.error("Usage: deno run -A manage_backlog.ts --data 'JSON_STRING'");
    Deno.exit(1);
  }

  const data: BacklogData = JSON.parse(dataRaw);
  
  try {
    const backlogContent = await Deno.readTextFile(BACKLOG_PATH);
    const archiveContent = await Deno.readTextFile(ARCHIVE_PATH);

    const { block, regex } = extractPbiBlock(backlogContent, data.id);
    const archiveCard = transformToArchiveCard(data, block);
    const { newBacklog, newArchive } = updateContents(backlogContent, archiveContent, regex, archiveCard);

    console.log("--- PREVIEW: BACKLOG CHANGES ---");
    console.log(`PBI [${data.id}] will be removed.`);
    console.log("\n--- PREVIEW: ARCHIVE CHANGES ---");
    console.log(archiveCard);

    await Deno.writeTextFile(BACKLOG_PATH, newBacklog);
    await Deno.writeTextFile(ARCHIVE_PATH, newArchive);

    console.log("\nSuccessfully archived PBI.");
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${String(err)}`);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
