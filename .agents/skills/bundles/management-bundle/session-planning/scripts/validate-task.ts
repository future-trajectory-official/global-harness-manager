export interface PhaseTaskRequirement {
  phaseName: string;
  foreach?: string;
  keywords: string[];
}

export interface GuardRules {
  requiredH2s: string[];
  requiredH3s: string[];
  requiredMetrics: string[];
  requiredTasks: PhaseTaskRequirement[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DEFAULT_RULES: GuardRules = {
  requiredH2s: ["📊 セッションメトリクス & 予実管理", "📋 実行タスク一覧"],
  requiredH3s: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
  requiredMetrics: ["初期見積 (想定介入回数)", "計画後見積 (想定介入回数)", "実際の介入回数"],
  requiredTasks: [],
};

function extractListItems(section: string): string[] {
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function extractRequiredTasks(section: string): PhaseTaskRequirement[] {
  const cleaned = stripHtmlComments(section);
  const lines = cleaned.split("\n");
  const tasks: PhaseTaskRequirement[] = [];
  let current: PhaseTaskRequirement | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === "") continue;

    if (trimmed.startsWith("- ") && !rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      if (current) tasks.push(current);
      const afterDash = trimmed.slice(2).trim();
      const foreachMatch = afterDash.match(/Foreach\s*\(AC\[\]\.count\)/i);
      const foreach = foreachMatch ? "AC[].count" : undefined;
      const colonIndex = afterDash.indexOf(":");
      let phaseName: string;
      if (colonIndex === -1) {
        phaseName = afterDash;
      } else {
        phaseName = afterDash.slice(0, colonIndex).trim();
      }
      current = { phaseName, foreach, keywords: [] };
    } else if (trimmed.startsWith("- ") && current) {
      current.keywords.push(trimmed.slice(2).trim());
    }
  }
  if (current) tasks.push(current);

  return tasks;
}

export function parseGuardBlock(content: string): GuardRules | null {
  const guardStart = content.indexOf("GUARD:REQUIRED_H2");
  if (guardStart === -1) return null;

  const beforeBlock = content.slice(0, guardStart);
  const blockStart = beforeBlock.lastIndexOf("<!--");
  const blockEnd = content.indexOf("-->", guardStart);
  if (blockStart === -1 || blockEnd === -1) return null;

  const block = content.slice(blockStart + 4, blockEnd);

  const rules: GuardRules = {
    requiredH2s: [],
    requiredH3s: [],
    requiredMetrics: [],
    requiredTasks: [],
  };

  const h2Match = block.match(/GUARD:REQUIRED_H2\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (h2Match) rules.requiredH2s = extractListItems(h2Match[1]);

  const h3Match = block.match(/GUARD:REQUIRED_H3\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (h3Match) rules.requiredH3s = extractListItems(h3Match[1]);

  const metricsMatch = block.match(/GUARD:REQUIRED_METRICS\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (metricsMatch) rules.requiredMetrics = extractListItems(metricsMatch[1]);

  const tasksMatch = block.match(/GUARD:REQUIRED_TASKS\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (tasksMatch) rules.requiredTasks = extractRequiredTasks(tasksMatch[1]);

  return rules;
}

function hasHeader(content: string, level: number, text: string): boolean {
  const prefix = "#".repeat(level) + " ";
  return content.split("\n").some((line) => line.trimStart().startsWith(prefix + text));
}

function containsText(content: string, keyword: string): boolean {
  return content.includes(keyword);
}

function getPhaseSection(content: string, phaseName: string): string {
  const headerPrefix = `### ${phaseName}`;
  const phaseStart = content.indexOf(headerPrefix);
  if (phaseStart === -1) return "";

  const afterHeader = content.slice(phaseStart);
  const nextSection = afterHeader.search(/\n#{2,3} (?!#)/);
  return nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);
}

export function countACs(planContent: string): number {
  const lines = planContent.split("\n");
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]") && /AC-\d+/i.test(trimmed)) {
      count++;
    }
  }
  return count;
}

function countKeywordOccurrences(content: string, keyword: string): number {
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = content.indexOf(keyword, pos);
    if (idx === -1) break;
    count++;
    pos = idx + keyword.length;
  }
  return count;
}

export function validateTaskMd(
  content: string,
  rules?: GuardRules,
  planACCount?: number,
): ValidationResult {
  const resolvedRules = rules ?? DEFAULT_RULES;
  const errors: string[] = [];

  if (!content || content.trim() === "") {
    errors.push("Content is empty");
    return { valid: false, errors };
  }

  for (const h2 of resolvedRules.requiredH2s) {
    if (!hasHeader(content, 2, h2)) {
      errors.push(`Missing required H2 header: '## ${h2}'`);
    }
  }

  if (resolvedRules.requiredH2s.some((h) => content.includes(h))) {
    for (const metric of resolvedRules.requiredMetrics) {
      if (!containsText(content, metric)) {
        errors.push(`Missing required metrics field: '${metric}'`);
      }
    }
  }

  for (const h3 of resolvedRules.requiredH3s) {
    if (!hasHeader(content, 3, h3)) {
      errors.push(`Missing required H3 header: '### ${h3}'`);
    }
  }

  const taskListHeader = resolvedRules.requiredH2s.find((h) => h.includes("実行タスク一覧"));
  if (taskListHeader) {
    const taskSectionTag = `## ${taskListHeader}`;
    const taskSectionStart = content.indexOf(taskSectionTag);
    if (taskSectionStart !== -1) {
      const taskSection = content.slice(taskSectionStart);
      const taskItems = taskSection.match(/^\s*- \[ \]/gm);
      if (!taskItems || taskItems.length === 0) {
        errors.push("No task checklist items ('- [ ]') found in the task list section");
      }
    }
  }

  for (const phase of resolvedRules.requiredTasks) {
    const section = getPhaseSection(content, phase.phaseName);
    if (!section) continue;

    const requiredCount = (phase.foreach === "AC[].count" && planACCount !== undefined)
      ? planACCount
      : 1;

    for (const keyword of phase.keywords) {
      const found = countKeywordOccurrences(section, keyword);
      if (found < requiredCount) {
        errors.push(
          `Phase '${phase.phaseName}' requires keyword '${keyword}' at least ${requiredCount} time(s), but found ${found}`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function printUsage(): void {
  console.error("Usage:");
  console.error("  deno task validate-task <path-to-task.md>");
  console.error("  deno task validate-task <path-to-task.md> --template <path-to-template.md>");
  console.error("  deno task validate-task <path-to-task.md> --plan <path-to-plan.md>");
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length === 0) {
    printUsage();
    Deno.exit(1);
  }

  const templateIndex = args.indexOf("--template");
  const planIndex = args.indexOf("--plan");
  let taskPath: string;
  let rules: GuardRules | undefined;
  let planACCount: number | undefined;

  const consumedFlags = new Set<number>();

  if (planIndex !== -1 && planIndex + 1 < args.length) {
    consumedFlags.add(planIndex);
    consumedFlags.add(planIndex + 1);
    const planPath = args[planIndex + 1];
    try {
      const planContent = Deno.readTextFileSync(planPath);
      planACCount = countACs(planContent);
    } catch (e) {
      console.error(`Error: Could not read plan '${planPath}': ${e}`);
      Deno.exit(1);
    }
  }

  if (templateIndex !== -1 && templateIndex + 1 < args.length) {
    consumedFlags.add(templateIndex);
    consumedFlags.add(templateIndex + 1);
    const templatePath = args[templateIndex + 1];
    const positionalArgs = args.filter((_, i) => !consumedFlags.has(i));
    if (positionalArgs.length === 0) {
      console.error("Error: No task file specified.");
      printUsage();
      Deno.exit(1);
    }
    taskPath = positionalArgs[0];
    try {
      const templateContent = Deno.readTextFileSync(templatePath);
      const parsed = parseGuardBlock(templateContent);
      if (parsed) {
        rules = parsed;
      } else {
        console.error(
          `Warning: No GUARD block found in template '${templatePath}'. Using defaults.`,
        );
      }
    } catch (e) {
      console.error(`Error: Could not read template '${templatePath}': ${e}`);
      Deno.exit(1);
    }
  } else {
    taskPath = args.filter((_, i) => !consumedFlags.has(i))[0];
  }

  if (!taskPath) {
    console.error("Error: No task file specified.");
    printUsage();
    Deno.exit(1);
  }

  let content: string;
  try {
    content = Deno.readTextFileSync(taskPath);
  } catch (e) {
    console.error(`Error: Could not read file '${taskPath}': ${e}`);
    Deno.exit(1);
  }

  const result = validateTaskMd(content, rules, planACCount);
  if (result.valid) {
    console.log(`OK: ${taskPath} is valid.`);
  } else {
    console.error(`ERROR: ${taskPath} validation failed:`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    Deno.exit(1);
  }
}
