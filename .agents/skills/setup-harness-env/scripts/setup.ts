import { join, dirname, fromFileUrl } from "jsr:@std/path";
import { executeCommand, logger, pathUtil, fsUtil } from "../../../core/harness-core.ts";

async function main() {
  logger.info("Starting Deno-first environment setup...");

  const os = Deno.build.os; // "windows", "darwin", "linux"
  const arch = Deno.build.arch; // "x86_64", "aarch64"

  const scriptDir = dirname(fromFileUrl(import.meta.url));
  const harnessRoot = pathUtil.resolvePath(scriptDir, "..", "..", "..", "..");
  const binDir = join(harnessRoot, "bin");
  const configPath = join(harnessRoot, "config", "global-skills-path.txt");
  
  // OS-specific variables
  let ghTarget = "";
  let isZip = false;

  if (os === "linux") {
    ghTarget = arch === "aarch64" ? "linux_arm64" : "linux_amd64";
  } else if (os === "darwin") {
    ghTarget = arch === "aarch64" ? "macOS_arm64" : "macOS_amd64";
    isZip = true;
  } else if (os === "windows") {
    ghTarget = "windows_amd64"; // Assuming amd64 for Windows
    isZip = true;
  }

  // 1. Download GitHub CLI (gh)
  const ghExe = os === "windows" ? "gh.exe" : "gh";
  const ghPath = join(binDir, ghExe);

  if (!(await fsUtil.exists(ghPath))) {
    logger.info(`Downloading GitHub CLI for ${os}_${arch}...`);
    const ghVersion = "v2.47.0";
    const ext = isZip ? "zip" : "tar.gz";
    const ghFile = `gh_${ghVersion.substring(1)}_${ghTarget}.${ext}`;
    const ghUrl = `https://github.com/cli/cli/releases/download/${ghVersion}/${ghFile}`;
    const downloadPath = join(binDir, ghFile);

    // Download using curl (or powershell on windows)
    if (os === "windows") {
      await executeCommand({ cmd: "powershell", args: ["-Command", `Invoke-WebRequest -Uri "${ghUrl}" -OutFile "${downloadPath}"`] });
      await executeCommand({ cmd: "powershell", args: ["-Command", `Expand-Archive -Path "${downloadPath}" -DestinationPath "${binDir}" -Force`] });
      const extractDir = join(binDir, `gh_${ghVersion.substring(1)}_${ghTarget}`);
      await executeCommand({ cmd: "cmd", args: ["/c", "move", join(extractDir, "bin", "gh.exe"), ghPath] });
      await executeCommand({ cmd: "cmd", args: ["/c", "rmdir", "/s", "/q", extractDir] });
      await executeCommand({ cmd: "cmd", args: ["/c", "del", downloadPath] });
    } else {
      await executeCommand({ cmd: "curl", args: ["-sL", ghUrl, "-o", downloadPath] });
      if (isZip) {
        await executeCommand({ cmd: "unzip", args: ["-q", downloadPath, "-d", binDir] });
        const extractDir = join(binDir, `gh_${ghVersion.substring(1)}_${ghTarget}`);
        await executeCommand({ cmd: "mv", args: [join(extractDir, "bin", "gh"), ghPath] });
        await executeCommand({ cmd: "rm", args: ["-rf", extractDir, downloadPath] });
      } else {
        await executeCommand({ cmd: "tar", args: ["xzf", downloadPath, "-C", binDir, "--strip-components=1"] });
        await executeCommand({ cmd: "mv", args: [join(binDir, "bin", "gh"), ghPath] });
        await executeCommand({ cmd: "rm", args: ["-rf", join(binDir, "bin"), join(binDir, "share"), downloadPath] });
      }
      await executeCommand({ cmd: "chmod", args: ["+x", ghPath] });
    }
    logger.info("GitHub CLI installed successfully.");
  } else {
    logger.info("GitHub CLI already exists.");
  }

  // 2. Setup PATH
  logger.info("Configuring PATH...");
  if (os === "windows") {
    const res = await executeCommand({
      cmd: "powershell",
      args: ["-Command", "[Environment]::GetEnvironmentVariable('Path', 'User')"]
    });
    const userPath = res.stdout.trim();
    if (!userPath.includes(binDir)) {
      await executeCommand({
        cmd: "powershell",
        args: ["-Command", `[Environment]::SetEnvironmentVariable('Path', '${userPath};${binDir}', 'User')`]
      });
      logger.info("Added to Windows User PATH. Please restart terminal.");
    }
  } else {
    const profileFile = os === "darwin" ? join(Deno.env.get("HOME") || "", ".zshrc") : join(Deno.env.get("HOME") || "", ".bashrc");
    if (await fsUtil.exists(profileFile)) {
      const content = await fsUtil.readTextFile(profileFile);
      if (!content.includes(binDir)) {
        await fsUtil.writeTextFile(profileFile, content + `\n# global-harness-manager\nexport PATH="$PATH:${binDir}"\n`);
        logger.info(`Added to ${profileFile}. Please run 'source ${profileFile}'.`);
      }
    }
  }

  // 3. Register skills.txt
  logger.info("Registering skills...");
  if (await fsUtil.exists(configPath)) {
    const configContent = await fsUtil.readTextFile(configPath);
    const lines = configContent.split(/\r?\n/);
    const skillsFilePath = join(Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "", ".gemini", "antigravity", "skills.txt");
    
    let existingPaths: string[] = [];
    if (await fsUtil.exists(skillsFilePath)) {
      const existingContent = await fsUtil.readTextFile(skillsFilePath);
      existingPaths = existingContent.split(/\r?\n/).filter(p => p.trim() !== "");
    }

    let modified = false;
    for (const line of lines) {
      if (line.trim() === "" || line.startsWith("#")) continue;
      const absPath = pathUtil.resolvePath(harnessRoot, line.trim());
      
      // Ensure directory exists
      if (!(await fsUtil.exists(absPath))) {
        await Deno.mkdir(absPath, { recursive: true });
      }

      if (!existingPaths.includes(absPath)) {
        existingPaths.push(absPath);
        modified = true;
      }
    }

    if (modified) {
      const skillsDir = join(skillsFilePath, "..");
      if (!(await fsUtil.exists(skillsDir))) {
        await Deno.mkdir(skillsDir, { recursive: true });
      }
      await fsUtil.writeTextFile(skillsFilePath, existingPaths.join("\n") + "\n");
      logger.info("Updated skills.txt successfully.");
    } else {
      logger.info("Skills already registered.");
    }
  } else {
    logger.warn(`Config file not found: ${configPath}`);
  }

  logger.info("--- Setup Complete ---");
}

main().catch(e => logger.error(`Setup failed: ${e.message}`));
