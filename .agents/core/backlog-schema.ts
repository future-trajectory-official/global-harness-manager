import { dirname, fromFileUrl, join, resolve } from "@std/path";

export interface BacklogField {
  key: string;
  type: "field" | "list" | "subfield-group";
  subFields: string[];
}

export interface BacklogSchema {
  fields: BacklogField[];
  archiveFields: BacklogField[];
  sections: string[];
}

const PROJECT_ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../..");

function readTextFileSync(path: string): string {
  const resolved = join(PROJECT_ROOT, path);
  try {
    return Deno.readTextFileSync(resolved);
  } catch {
    throw new Error(`Schema source file not found: ${path} (git-tracked .example is required)`);
  }
}

function collectFields(exampleContent: string): BacklogField[] {
  const fields: BacklogField[] = [];
  const lines = exampleContent.split("\n");
  let currentListField: string | null = null;
  let currentListItems: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fieldMatch = line.match(/^-\s+\*\*(.+?)\*\*:/);
    if (fieldMatch) {
      if (currentListField) {
        fields.push({ key: currentListField, type: "list", subFields: [...currentListItems] });
        currentListItems = [];
      }
      currentListField = null;

      const key = fieldMatch[1].trim();
      const rest = line.slice(fieldMatch[0].length).trim();

      if (rest === "" && i + 1 < lines.length && lines[i + 1].trim().startsWith("- ")) {
        currentListField = key;
      } else if (rest === "" && i + 1 < lines.length && lines[i + 1].trim().startsWith("  - ")) {
        currentListField = key;
      } else {
        fields.push({ key, type: "field", subFields: [] });
      }
    } else if (currentListField && line.trim().startsWith("- **")) {
      const subMatch = line.match(/-\s+\*\*(.+?)\*\*:/);
      if (subMatch) {
        currentListItems.push(subMatch[1].trim());
      }
    } else if (currentListField && line.trim().startsWith("- ")) {
      currentListItems.push(line.trim().slice(2));
    } else if (currentListField && !line.trim().startsWith("  ") && !line.trim().startsWith("-")) {
      fields.push({ key: currentListField, type: "list", subFields: [...currentListItems] });
      currentListField = null;
      currentListItems = [];
    }
  }
  if (currentListField) {
    fields.push({ key: currentListField, type: "list", subFields: [...currentListItems] });
  }

  return fields;
}

function collectSections(exampleContent: string): string[] {
  return exampleContent
    .split("\n")
    .filter((l) => l.startsWith("#### "))
    .map((l) => l.slice(5).trim());
}

const DEFAULT_FIELD_MAP: Record<string, string> = {
  "完了日": "_date",
  "スプリント": "sprint",
  "見積サイズ": "sizeEstimated",
  "実感サイズ": "sizeActual",
  "成果物": "outcomes",
  "Effort実績 (介入回数)": "_effort",
  "予実差分析": "insights",
  "カテゴリ": "tags",
};

export function loadBacklogSchema(examplePath?: string): BacklogSchema {
  const backlogExample = examplePath || ".agents/management/product-backlog.md.example";
  const archiveExample = ".agents/management/product-backlog-archive.md.example";

  const backlogContent = readTextFileSync(backlogExample);
  const archiveContent = readTextFileSync(archiveExample);

  return {
    fields: collectFields(backlogContent),
    archiveFields: collectFields(archiveContent),
    sections: collectSections(archiveContent),
  };
}

export function extractPbiBlock(
  content: string,
  pbiId: string,
  _schema?: BacklogSchema,
): { block: string; regex: RegExp } {
  const escapedId = pbiId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `### \\[(?:DONE|WIP|TODO)\\] ${escapedId}[\\s\\S]*?(?=\\n###[^#]|\\n##(?!#)|$)`,
  );
  const match = content.match(regex);
  if (!match) throw new Error(`PBI not found: ${pbiId}`);
  return { block: match[0], regex };
}

export function buildArchiveCard(
  data: Record<string, unknown>,
  _pbiBlock: string,
  schema: BacklogSchema,
): string {
  const today = new Date().toISOString().split("T")[0];
  const tags = (data.tags as string[]) || [];
  const outcomes = (data.outcomes as string[]) || [];

  let card = "";
  card += `\n### [DONE] ${data.id}\n\n`;

  for (const field of schema.archiveFields) {
    const key = field.key;

    if (key === "完了日") {
      card += `- **${key}**: ${today}\n`;
    } else if (key === "成果物") {
      card += `- **${key}**:\n`;
      if (outcomes.length > 0) {
        card += outcomes.map((o: string) => `  ${o}`).join("\n") + "\n";
      } else {
        card += "  - N/A\n";
      }
    } else if (key === "Effort実績 (介入回数)") {
      card += `- **${key}**:\n`;
      card += `  - 計画前見積合計: ${data.effortPreplan ?? data.planPre ?? 0}回\n`;
      card += `  - 計画後見積合計: ${data.effortPostplan ?? data.planPost ?? 0}回\n`;
      card += `  - 完了時実績合計: ${data.effortActual ?? data.actualEffort ?? 0}回\n`;
    } else if (key === "カテゴリ") {
      card += `- **${key}**: ${tags.map((t: string) => `\`${t}\``).join(" ")}\n`;
    } else if (field.type === "subfield-group") {
      card += `- **${key}**:\n`;
      for (const sub of field.subFields) {
        const subKey = DEFAULT_FIELD_MAP[sub] || sub;
        card += `  - ${sub}: ${data[subKey] ?? ""}\n`;
      }
    } else {
      const dataKey = DEFAULT_FIELD_MAP[key] || key;
      card += `- **${key}**: ${data[dataKey] ?? ""}\n`;
    }
  }

  const plannedAchieved = (data.wpPlannedAchieved as string[]) || [];
  const plannedMissed = (data.wpPlannedMissed as string[]) || [];
  const addedAchieved = (data.wpAddedAchieved as string[]) || [];
  const addedMissed = (data.wpAddedMissed as string[]) || [];

  if (plannedAchieved.length > 0 || plannedMissed.length > 0) {
    card += `\n#### 計画時WPのAC達成状況\n\n`;
    for (const ac of plannedAchieved) card += `- [x] ${ac}\n`;
    for (const ac of plannedMissed) card += `- [ ] ${ac}\n`;
  }

  if (addedAchieved.length > 0 || addedMissed.length > 0) {
    card += `\n#### スプリント中追加WPのAC達成状況\n\n`;
    for (const ac of addedAchieved) card += `- [x] ${ac}\n`;
    for (const ac of addedMissed) card += `- [ ] ${ac}\n`;
  }

  return card;
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
