import { parseArgs } from "@std/cli";

/**
 * manage_backlog.ts
 *
 * バックログアイテムのアーカイブ処理を自動化するスクリプト。
 * AI 間の JSON インターフェースを前提とし、正確な抽出と構造的なアーカイブを実現する。
 */

export interface BacklogData {
  id: string;
  sprint: string;
  insights: string;
  tags: string[];
  metrics: { turns: number; sessions: number };
  outcomes: string[];
  sizeEstimated: string;
  sizeActual: string;
  effortPreplan: number;
  effortPostplan: number;
  effortActual: number;
  wpPlannedAchieved: string[];
  wpPlannedMissed: string[];
  wpAddedAchieved: string[];
  wpAddedMissed: string[];
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

export function transformToArchiveCard(data: BacklogData, _pbiBlock: string): string {
  const today = new Date().toISOString().split("T")[0];
  const tagsStr = data.tags.map((t) => `\`${t}\``).join(" ");

  const outcomesStr = data.outcomes.length > 0
    ? data.outcomes.map((o) => `  ${o}`).join("\n")
    : "  - N/A";

  const effortStr = `  - 計画前見積合計: ${data.effortPreplan}回\n` +
    `  - 計画後見積合計: ${data.effortPostplan}回\n` +
    `  - 完了時実績合計: ${data.effortActual}回`;

  const plannedAchieved = data.wpPlannedAchieved.map((ac) => `- [x] ${ac}`).join("\n");
  const plannedMissed = data.wpPlannedMissed.map((ac) => `- [ ] ${ac}`).join("\n");
  const addedAchieved = data.wpAddedAchieved.map((ac) => `- [x] ${ac}`).join("\n");
  const addedMissed = data.wpAddedMissed.map((ac) => `- [ ] ${ac}`).join("\n");

  let plannedSection = "";
  if (plannedAchieved || plannedMissed) {
    plannedSection = `\n#### 計画時WPのAC達成状況\n\n${plannedAchieved}`;
    if (plannedMissed) plannedSection += "\n" + plannedMissed;
  }

  let addedSection = "";
  if (addedAchieved || addedMissed) {
    addedSection = `\n#### スプリント中追加WPのAC達成状況\n\n${addedAchieved}`;
    if (addedMissed) addedSection += "\n" + addedMissed;
  }

  return `
### [DONE] ${data.id}

- **完了日**: ${today}
- **スプリント**: ${data.sprint}
- **見積サイズ**: ${data.sizeEstimated}
- **実感サイズ**: ${data.sizeActual}
- **成果物**:
${outcomesStr}
- **Effort実績 (介入回数)**:
${effortStr}
- **予実差分析**:
  ${data.insights}
- **カテゴリ**: ${tagsStr}
${plannedSection}${addedSection}
`;
}

export function updateContents(
  backlogContent: string,
  archiveContent: string,
  pbiRegex: RegExp,
  archiveCard: string,
): { newBacklog: string; newArchive: string } {
  const newBacklog = backlogContent.replace(pbiRegex, "").replace(/\n{3,}/g, "\n\n").trim() + "\n";

  const anchor = "## 完了済みアイテム";
  const anchorIndex = archiveContent.indexOf(anchor);
  if (anchorIndex === -1) throw new Error("Anchor '## 完了済みアイテム' not found.");

  const insertPosition = anchorIndex + anchor.length;
  const newArchive = archiveContent.slice(0, insertPosition) +
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
    const { newBacklog, newArchive } = updateContents(
      backlogContent,
      archiveContent,
      regex,
      archiveCard,
    );

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
