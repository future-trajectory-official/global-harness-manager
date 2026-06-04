interface ValidationResult {
  valid: boolean;
  violations: Array<{ file: string; line: number; testName: string }>;
}

const JSDOC_RE = /\/\*\*[\s\S]*?\*\//;
const DENO_TEST_RE = /Deno\.test\(\s*"/g;

function findViolations(
  content: string,
  filePath: string,
): Array<{ file: string; line: number; testName: string }> {
  const violations: Array<{ file: string; line: number; testName: string }> = [];
  const lines = content.split("\n");
  const testIndices: number[] = [];

  let match: RegExpExecArray | null;
  DENO_TEST_RE.lastIndex = 0;
  while ((match = DENO_TEST_RE.exec(content)) !== null) {
    const startPos = match.index;
    const lineNum = content.slice(0, startPos).split("\n").length;
    testIndices.push(lineNum);
  }

  for (const testLine of testIndices) {
    const startLine = Math.max(0, testLine - 6);
    const precedingBlock = lines.slice(startLine, testLine).join("\n");
    if (!JSDOC_RE.test(precedingBlock)) {
      const testNameMatch = lines[testLine - 1]?.match(/Deno\.test\(\s*"([^"]+)"/);
      const testName = testNameMatch ? testNameMatch[1] : "unknown";
      violations.push({ file: filePath, line: testLine, testName });
    }
  }

  return violations;
}

async function collectTestFiles(): Promise<string[]> {
  const testFiles: string[] = [];
  for await (const entry of Deno.readDir(".")) {
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      testFiles.push(...await collectFromDir(entry.name));
    }
  }
  return testFiles;
}

async function collectFromDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...await collectFromDir(fullPath));
      } else if (entry.isFile && entry.name.endsWith("_test.ts")) {
        files.push(fullPath);
      }
    }
  } catch {
    // permission denied, skip
  }
  return files;
}

async function validateAll(): Promise<ValidationResult> {
  const files = await collectTestFiles();
  const violations: Array<{ file: string; line: number; testName: string }> = [];

  for (const file of files) {
    try {
      const content = await Deno.readTextFile(file);
      const fileViolations = findViolations(content, file);
      violations.push(...fileViolations);
    } catch {
      // skip unreadable files
    }
  }

  return { valid: violations.length === 0, violations };
}

if (import.meta.main) {
  const result = await validateAll();
  if (result.valid) {
    console.log("OK: All Deno.test() calls have JSDoc comments.");
    Deno.exit(0);
  } else {
    console.error(`FAIL: ${result.violations.length} Deno.test() call(s) without JSDoc:`);
    for (const v of result.violations) {
      console.error(`  ${v.file}:${v.line} — "${v.testName}"`);
    }
    Deno.exit(1);
  }
}
