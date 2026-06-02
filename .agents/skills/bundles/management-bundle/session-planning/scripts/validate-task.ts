export interface GuardRules {
  requiredH2s: string[];
  requiredH3s: string[];
  requiredMetrics: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DEFAULT_RULES: GuardRules = {
  requiredH2s: ["📊 セッションメトリクス & 予実管理", "📋 実行タスク一覧"],
  requiredH3s: ["Phase 1", "Phase 2", "Phase 3", "Phase 4"],
  requiredMetrics: ["初期見積 (想定介入回数)", "計画後見積 (想定介入回数)", "実際の介入回数"],
};

function extractListItems(section: string): string[] {
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
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
  };

  const h2Match = block.match(/GUARD:REQUIRED_H2\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (h2Match) rules.requiredH2s = extractListItems(h2Match[1]);

  const h3Match = block.match(/GUARD:REQUIRED_H3\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (h3Match) rules.requiredH3s = extractListItems(h3Match[1]);

  const metricsMatch = block.match(/GUARD:REQUIRED_METRICS\n([\s\S]*?)(?=\nGUARD:|$)/);
  if (metricsMatch) rules.requiredMetrics = extractListItems(metricsMatch[1]);

  return rules;
}

function hasHeader(content: string, level: number, text: string): boolean {
  const prefix = "#".repeat(level) + " ";
  return content.split("\n").some((line) => line.trimStart().startsWith(prefix + text));
}

function containsText(content: string, keyword: string): boolean {
  return content.includes(keyword);
}

export function validateTaskMd(content: string, rules?: GuardRules): ValidationResult {
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

  return {
    valid: errors.length === 0,
    errors,
  };
}

function printUsage(): void {
  console.error("Usage:");
  console.error("  deno task validate-task <path-to-task.md>");
  console.error("  deno task validate-task <path-to-task.md> --template <path-to-template.md>");
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length === 0) {
    printUsage();
    Deno.exit(1);
  }

  const templateIndex = args.indexOf("--template");
  let taskPath: string;
  let rules: GuardRules | undefined;

  if (templateIndex !== -1 && templateIndex + 1 < args.length) {
    const templatePath = args[templateIndex + 1];
    const positionalArgs = args.filter(
      (_, i) => i !== templateIndex && i !== templateIndex + 1,
    );
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
    taskPath = args[0];
  }

  let content: string;
  try {
    content = Deno.readTextFileSync(taskPath);
  } catch (e) {
    console.error(`Error: Could not read file '${taskPath}': ${e}`);
    Deno.exit(1);
  }

  const result = validateTaskMd(content, rules);
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
