import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { executeCommand, fsUtil, logger } from "../../../../../core/harness-core.ts";

const DEFAULT_SANDBOX_BASE = "/tmp/harness-sandboxes";

export async function detectLanguage(): Promise<string> {
  if (await fsUtil.exists("deno.json") || await fsUtil.exists("deno.jsonc")) return "deno";
  if (await fsUtil.exists("package.json")) return "node";
  if (await fsUtil.exists("requirements.txt") || await fsUtil.exists("pyproject.toml")) {
    return "python";
  }
  return "deno"; // デフォルト
}

export async function createSandbox(
  name: string,
  mode: "directory" | "container",
  base: string,
  lang?: string,
) {
  const sandboxPath = join(base, name);

  if (await fsUtil.exists(sandboxPath)) {
    throw new Error(`Sandbox "${name}" already exists at ${sandboxPath}`);
  }

  if (mode === "directory") {
    logger.info(`Creating directory sandbox: ${sandboxPath}`);
    await Deno.mkdir(sandboxPath, { recursive: true });

    const currentRepo = Deno.cwd();
    await executeCommand({
      cmd: "git",
      args: ["clone", currentRepo, sandboxPath],
    });

    logger.info(`✅ Sandbox created at ${sandboxPath}`);
  } else if (mode === "container") {
    const detectedLang = lang || await detectLanguage();
    logger.info(`Detected language: ${detectedLang}`);

    const dockerfilePath = join(
      Deno.cwd(),
      `.agents/skills/bundles/development-bundle/develop-environment-setup/assets/dockerfiles/${detectedLang}.Dockerfile`,
    );

    if (!(await fsUtil.exists(dockerfilePath))) {
      logger.warn(`Dockerfile for ${detectedLang} not found. Falling back to deno.Dockerfile.`);
    }

    const finalDockerfile = (await fsUtil.exists(dockerfilePath)) ? dockerfilePath : join(
      Deno.cwd(),
      ".agents/skills/bundles/development-bundle/develop-environment-setup/assets/dockerfiles/deno.Dockerfile",
    );

    logger.info(`Building sandbox image using ${finalDockerfile}...`);
    await executeCommand({
      cmd: "docker",
      args: ["build", "-t", "harness-sandbox-base", "-f", finalDockerfile, "."],
    });

    const containerName = `harness-sandbox-${name}`;
    logger.info(`Starting sandbox container: ${containerName}`);
    await executeCommand({
      cmd: "docker",
      args: [
        "run",
        "-d",
        "--name",
        containerName,
        "harness-sandbox-base",
        "tail",
        "-f",
        "/dev/null",
      ],
    });

    // コードのコピー
    logger.info(`Copying code to container...`);
    await executeCommand({
      cmd: "docker",
      args: ["cp", ".", `${containerName}:/app`],
    });

    logger.info(`✅ Sandbox container "${containerName}" is ready.`);
  }
}

async function destroySandbox(name: string, base: string) {
  // ディレクトリの削除
  const sandboxPath = join(base, name);
  if (await fsUtil.exists(sandboxPath)) {
    logger.info(`Destroying directory sandbox: ${sandboxPath}`);
    await Deno.remove(sandboxPath, { recursive: true });
  }

  // コンテナの削除
  const containerName = `harness-sandbox-${name}`;
  try {
    const res = await executeCommand({
      cmd: "docker",
      args: ["ps", "-a", "--filter", `name=${containerName}`, "--format", "{{.Names}}"],
    });

    if (res.stdout.includes(containerName)) {
      logger.info(`Destroying container: ${containerName}`);
      await executeCommand({
        cmd: "docker",
        args: ["rm", "-f", containerName],
      });
      logger.info(`✅ Container "${containerName}" destroyed.`);
    }
  } catch (e) {
    logger.warn(`Failed to check/destroy container: ${(e as Error).message}`);
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["name", "mode", "base", "lang"],
    default: { base: DEFAULT_SANDBOX_BASE, mode: "directory" },
  });

  const command = args._[0];
  const name = args.name;
  const mode = args.mode as "directory" | "container";
  const base = args.base;
  const lang = args.lang;

  if (!command || !name) {
    console.log(
      "Usage: manage-sandbox [create|destroy] --name <name> [--mode directory|container] [--lang deno|node|python]",
    );
    Deno.exit(1);
  }

  try {
    switch (command) {
      case "create":
        await createSandbox(name, mode, base, lang);
        break;
      case "destroy":
        await destroySandbox(name, base);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        Deno.exit(1);
    }
  } catch (e) {
    logger.error((e as Error).message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
