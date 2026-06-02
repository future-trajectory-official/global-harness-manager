import { parseArgs } from "@std/cli";

interface StagedFile {
  path: string;
  status: string;
}

function printHeader(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function runGit(args: string[]): { code: number; stdout: string; stderr: string } {
  const cmd = new Deno.Command("git", { args });
  const { code, stdout, stderr } = cmd.outputSync();
  const decoder = new TextDecoder("utf-8");
  return {
    code,
    stdout: decoder.decode(stdout).trim(),
    stderr: decoder.decode(stderr).trim(),
  };
}

function getChangedFiles(): StagedFile[] {
  const result = runGit(["diff", "--cached", "--name-status"]);
  if (!result.stdout) return [];
  return result.stdout.split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return { status: parts[0], path: parts[1] || "" };
    });
}

function hasUncommittedChanges(): boolean {
  const result = runGit(["status", "--porcelain"]);
  return result.stdout.length > 0;
}

function commitAllAsWip(): void {
  runGit(["add", "-A"]);
  const result = runGit(["commit", "-m", "[wip] savepoint"]);
  if (result.code === 0) {
    console.log(result.stdout);
  } else {
    console.error(result.stderr || "nothing to commit");
  }
}

function getDefaultBranch(): string {
  const remoteResult = runGit(["remote", "get-url", "origin"]);
  if (remoteResult.code === 0) {
    const headResult = runGit(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    if (headResult.code === 0) {
      return headResult.stdout.replace("refs/remotes/origin/", "");
    }
  }
  return "main";
}

function softResetToBase(baseBranch: string): boolean {
  const result = runGit(["reset", "--soft", baseBranch]);
  if (result.code !== 0) {
    console.error(`Failed to reset to ${baseBranch}: ${result.stderr}`);
    return false;
  }
  return true;
}

export function classifyFileType(filePath: string): string {
  if (filePath.endsWith("_test.ts")) return "test";
  if (filePath.endsWith(".ts")) return "source";
  if (filePath.endsWith(".md")) return "docs";
  if (filePath.endsWith(".json") || filePath.endsWith(".jsonc")) return "config";
  return "other";
}

export function suggestTypeFromFiles(files: StagedFile[]): string | null {
  const categories = new Set(files.map((f) => classifyFileType(f.path)));
  const allTest = files.every((f) => classifyFileType(f.path) === "test");
  const allDocs = files.every((f) => classifyFileType(f.path) === "docs");
  const allConfig = files.every((f) => classifyFileType(f.path) === "config");
  const hasSource = files.some((f) => classifyFileType(f.path) === "source");

  if (allTest) return "test";
  if (allDocs) return "docs";
  if (allConfig) return "chore";
  if (hasSource && categories.size === 1) return "feat";

  return null;
}

export function validateTypeConsistency(commitType: string, files: StagedFile[]): string | null {
  const validTypes = ["feat", "fix", "docs", "style", "refactor", "test", "chore"];
  if (!validTypes.includes(commitType)) {
    return `invalid conventional commit type: "${commitType}". Valid types: ${
      validTypes.join(", ")
    }`;
  }

  if (commitType === "docs") {
    const nonDocFiles = files.filter(
      (f) => !f.path.endsWith(".md") && !f.path.startsWith("docs/"),
    );
    if (nonDocFiles.length > 0) {
      return `type is "docs" but ${nonDocFiles.length} non-documentation files are included`;
    }
  }

  if (commitType === "test") {
    const nonTestFiles = files.filter((f) => !f.path.endsWith("_test.ts"));
    if (nonTestFiles.length > 0) {
      return `type is "test" but ${nonTestFiles.length} non-test files are included`;
    }
  }

  if (commitType === "feat" || commitType === "fix" || commitType === "refactor") {
    const docFiles = files.filter((f) => f.path.endsWith(".md") && !f.path.startsWith("docs/"));
    const configFiles = files.filter((f) => f.path.endsWith(".json"));
    const hasMixedTypes = docFiles.length > 0 || configFiles.length > 0;
    if (hasMixedTypes) {
      const mixed = [...docFiles, ...configFiles].map((f) => f.path).join(", ");
      return `type is "${commitType}" but includes documentation/config files: ${mixed}`;
    }
  }

  return null;
}

async function runTriage(): Promise<void> {
  const baseBranch = getDefaultBranch();
  printHeader(`Triage Mode: Soft-resetting to ${baseBranch}`);

  const allChanged = hasUncommittedChanges();
  if (!allChanged) {
    console.log("No changes detected. Nothing to triage.");
    return;
  }

  const hasCommits = runGit(["log", "--oneline", `${baseBranch}..HEAD`]);
  if (hasCommits.stdout) {
    console.log("WIP commits found:\n");
    console.log(hasCommits.stdout);
    console.log("");

    if (!softResetToBase(baseBranch)) {
      return;
    }
    console.log(`All changes are now staged (reset to ${baseBranch}).\n`);
  } else {
    const result = runGit(["add", "-A"]);
    if (result.code !== 0) {
      console.error("Failed to add files:", result.stderr);
      return;
    }
    console.log("All changes staged.\n");
  }

  const allFiles = getChangedFiles();
  if (allFiles.length === 0) {
    console.log("No staged files to triage.");
    return;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  let remainingFiles = [...allFiles];

  while (remainingFiles.length > 0) {
    printHeader("Changed Files (remaining)");
    console.log("  #  Status  File");
    console.log("  " + "-".repeat(60));
    remainingFiles.forEach((f, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}  ${f.status.padEnd(7)}  ${f.path}`);
    });

    console.log("");
    console.log("Select files to include in this commit.");
    console.log("Options:");
    console.log("  - Enter numbers (comma/space separated): e.g. 1,2,3");
    console.log("  - 'a' to select all remaining files");
    console.log("  - 'q' to quit (leave remaining files uncommitted)");
    console.log("");

    await Deno.stdout.write(encoder.encode("Select files: "));
    const inputBuf = new Uint8Array(4096);
    const nRead = await Deno.stdin.read(inputBuf);
    const selectionInput = nRead ? decoder.decode(inputBuf.subarray(0, nRead)).trim() : "";
    if (!selectionInput) continue;

    if (selectionInput.toLowerCase() === "q") {
      console.log("Triage cancelled. Remaining files left uncommitted.");
      if (remainingFiles.length > 0) {
        runGit(["restore", "--staged", ...remainingFiles.map((f) => f.path)]);
      }
      return;
    }

    let selectedFiles: StagedFile[];

    if (selectionInput.toLowerCase() === "a") {
      selectedFiles = [...remainingFiles];
    } else {
      const indices = selectionInput
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= remainingFiles.length);

      if (indices.length === 0) {
        console.log("Invalid selection. Try again.");
        continue;
      }

      selectedFiles = indices.map((i) => remainingFiles[i - 1]);
    }

    console.log("\nSelected files:");
    selectedFiles.forEach((f) => console.log(`  - ${f.path}`));

    const suggestedType = suggestTypeFromFiles(selectedFiles);
    const typeHint = suggestedType ? ` (suggested: ${suggestedType})` : "";

    console.log("");
    await Deno.stdout.write(
      encoder.encode(`Commit message (Conventional Commits format${typeHint}): `),
    );
    const msgBuf = new Uint8Array(4096);
    const nMsg = await Deno.stdin.read(msgBuf);
    const commitMsg = nMsg ? decoder.decode(msgBuf.subarray(0, nMsg)).trim() : "";
    if (!commitMsg) {
      console.log("Commit message cannot be empty. Try again.");
      continue;
    }

    const typeMatch = commitMsg.match(/^(\w+):/);
    const commitType = typeMatch ? typeMatch[1] : null;

    if (!commitType) {
      console.log(
        "Commit message must follow Conventional Commits format (e.g., 'feat: ...'). Try again.",
      );
      continue;
    }

    const validationError = validateTypeConsistency(commitType, selectedFiles);
    if (validationError) {
      console.log(`\n⚠️  Warning: ${validationError}`);
      await Deno.stdout.write(encoder.encode("Proceed anyway? (y/N): "));
      const confirmBuf = new Uint8Array(4096);
      const nConfirm = await Deno.stdin.read(confirmBuf);
      const confirm = nConfirm
        ? decoder.decode(confirmBuf.subarray(0, nConfirm)).trim().toLowerCase()
        : "";
      if (confirm !== "y") {
        console.log("Commit cancelled, please re-select files.");
        continue;
      }
    }

    const filePaths = selectedFiles.map((f) => f.path);
    const addResult = runGit(["add", ...filePaths]);
    if (addResult.code !== 0) {
      console.error("Failed to stage files:", addResult.stderr);
      continue;
    }

    const commitResult = runGit(["commit", "-m", commitMsg]);
    if (commitResult.code === 0) {
      console.log(commitResult.stdout);
    } else {
      console.error("Commit failed:", commitResult.stderr);
      runGit(["restore", "--staged", ...filePaths]);
      continue;
    }

    remainingFiles = remainingFiles.filter(
      (f) => !filePaths.includes(f.path),
    );

    console.log(`Remaining files: ${remainingFiles.length}`);
  }

  if (remainingFiles.length === 0) {
    console.log("\nAll files have been committed. Triage complete.");
  }
}

async function main() {
  const args = parseArgs(Deno.args);
  const mode = args._[0] as string | undefined;

  if (!mode) {
    console.log("Usage:");
    console.log("  deno run -A git-triage.ts wip      - Create a WIP savepoint");
    console.log("  deno run -A git-triage.ts triage   - Interactive atomic commit triage");
    Deno.exit(1);
  }

  switch (mode) {
    case "wip":
      commitAllAsWip();
      break;
    case "triage":
      await runTriage();
      break;
    default:
      console.error(`Unknown mode: ${mode}. Use 'wip' or 'triage'.`);
      Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
