import { executeCommand, fsUtil, logger, pathUtil } from "../../../../../core/harness-core.ts";

export interface Identity {
  accountName: string;
  accountEmail: string;
}

/**
 * identities.md をパースして Identity のリストを返す
 */
export function parseIdentities(content: string): Identity[] {
  const sections = content.split(/^##\s+/m).slice(1);
  const identities: Identity[] = [];
  const processedAccounts = new Set<string>();

  for (const section of sections) {
    const accountNameMatch = section.match(/-\s+\*\*Account Name\*\*:\s+`(.+?)`/);
    const accountEmailMatch = section.match(/-\s+\*\*User Email\*\*:\s+`(.+?)`/);

    if (!accountNameMatch || !accountEmailMatch) continue;

    const accountName = accountNameMatch[1].trim();
    const accountEmail = accountEmailMatch[1].trim();

    if (processedAccounts.has(accountName)) continue;
    processedAccounts.add(accountName);

    identities.push({ accountName, accountEmail });
  }
  return identities;
}

/**
 * SSH鍵が存在しない場合に生成する
 */
export async function ensureSshKey(identity: Identity, sshDir: string): Promise<string> {
  const sshKeyPath = pathUtil.joinPath(sshDir, `id_ed25519_${identity.accountName}`);

  if (await fsUtil.exists(sshKeyPath)) {
    logger.info(`Info: ${identity.accountName} 用の鍵は既に存在します。スキップします。`);
  } else {
    logger.info(`${identity.accountName} 用の SSH 鍵を生成中...`);
    if (!(await fsUtil.exists(sshDir))) {
      await Deno.mkdir(sshDir, { recursive: true });
    }

    const result = await executeCommand({
      cmd: "ssh-keygen",
      args: ["-t", "ed25519", "-C", identity.accountEmail, "-f", sshKeyPath, "-N", ""],
    });

    if (result.code !== 0) {
      throw new Error(`${identity.accountName} 用の鍵生成に失敗しました。`);
    }
  }
  return sshKeyPath;
}

/**
 * SSH Config を更新する
 */
export async function updateSshConfig(
  accountName: string,
  sshKeyPath: string,
  sshConfigPath: string,
) {
  const hostAlias = `github.com-${accountName}`;
  if (!(await fsUtil.exists(sshConfigPath))) await fsUtil.writeTextFile(sshConfigPath, "");

  const configContent = await fsUtil.readTextFile(sshConfigPath);
  if (!configContent.includes(`Host ${hostAlias}`)) {
    logger.info(`SSH エイリアスを構成中: ${hostAlias} ...`);
    const aliasConfig =
      `\n# Harness managed identity: ${accountName}\nHost ${hostAlias}\n    HostName github.com\n    User git\n    IdentityFile ${sshKeyPath}\n`;
    await Deno.writeTextFile(sshConfigPath, configContent + aliasConfig);
  }
}

async function main() {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  const harnessRoot = pathUtil.resolvePath(Deno.cwd());
  const identityConfig = pathUtil.joinPath(harnessRoot, "config", "identities.md");
  const sshDir = pathUtil.joinPath(homeDir, ".ssh");
  const sshConfig = pathUtil.joinPath(sshDir, "config");

  if (!(await fsUtil.exists(identityConfig))) {
    console.log("--- エラー: アイデンティティの登録を中断します ---");
    console.log(`警告: ${identityConfig} が見つかりませんでした。`);
    console.log("config/identities.md.example をコピーして設定を作成してください。");
    Deno.exit(1);
  }

  console.log("--- アイデンティティ登録処理を開始します (Identity Setup) ---");

  const content = await fsUtil.readTextFile(identityConfig);
  const identities = parseIdentities(content);
  const reportItems: string[] = [];

  for (const identity of identities) {
    try {
      const sshKeyPath = await ensureSshKey(identity, sshDir);
      await updateSshConfig(identity.accountName, sshKeyPath, sshConfig);

      // レポート用公開鍵読み取り
      const pubKeyPath = `${sshKeyPath}.pub`;
      if (await fsUtil.exists(pubKeyPath)) {
        const pubKeyContent = (await fsUtil.readTextFile(pubKeyPath)).trim();
        reportItems.push(`■ アカウント: ${identity.accountName}\n${pubKeyContent}`);
      }
    } catch (e) {
      logger.error((e as Error).message);
    }
  }

  if (reportItems.length > 0) {
    console.log("\n=== 以下の公開鍵を GitHub に登録してください ===");
    reportItems.forEach((item) => console.log(item + "\n"));
  }

  console.log("--------------------------------------------------------");
  console.log("アイデンティティ登録処理が完了しました。");
}

if (import.meta.main) {
  main();
}
