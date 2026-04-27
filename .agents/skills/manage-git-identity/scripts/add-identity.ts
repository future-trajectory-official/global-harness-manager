import { logger, pathUtil, fsUtil, executeCommand } from "../../../core/harness-core.ts";

async function main() {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  const harnessRoot = pathUtil.resolvePath(Deno.cwd());
  const identityConfig = pathUtil.joinPath(harnessRoot, "config", "identities.txt");
  const exampleConfig = pathUtil.joinPath(harnessRoot, "config", "identities.txt.example");
  const sshDir = pathUtil.joinPath(homeDir, ".ssh");
  const sshConfig = pathUtil.joinPath(sshDir, "config");

  if (!(await fsUtil.exists(identityConfig))) {
    console.log("--- エラー: アイデンティティの登録を中断します ---");
    console.log(`警告: ${identityConfig} が見つかりませんでした。\n`);
    console.log("【対応方法】:");
    console.log(`1. ${exampleConfig} をコピーして identities.txt を作成してください。`);
    console.log(`2. identities.txt に登録したいアカウント情報を記述してください。`);
    console.log(`3. 再度このスクリプトを実行してください。`);
    Deno.exit(1);
  }

  console.log("--- アイデンティティ登録処理を開始します (Identity Setup) ---");

  const reportItems: string[] = [];
  const text = await fsUtil.readTextFile(identityConfig);
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(",");
    const accountName = parts[0]?.trim();
    const accountEmail = parts[1]?.trim();

    if (!accountName || !accountEmail) {
      console.log(`警告: 行のフォーマットが正しくありません: ${trimmed} (スキップします)`);
      continue;
    }

    const sshKeyPath = pathUtil.joinPath(sshDir, `id_ed25519_${accountName}`);
    const hostAlias = `github.com-${accountName}`;

    // バックアップ処理
    if (await fsUtil.exists(sshKeyPath)) {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const backupPath = `${sshKeyPath}.bak_${timestamp}`;
      console.log(`Info: ${accountName} 用の鍵は既に存在します。古い鍵を退避します: ${backupPath}`);
      await Deno.rename(sshKeyPath, backupPath);
      
      const pubPath = `${sshKeyPath}.pub`;
      if (await fsUtil.exists(pubPath)) {
        await Deno.rename(pubPath, `${backupPath}.pub`);
      }
    }

    console.log(`${accountName} 用の SSH 鍵を生成中...`);
    if (!(await fsUtil.exists(sshDir))) {
      await Deno.mkdir(sshDir, { recursive: true });
    }

    // ssh-keygenの実行 (対話なし、パスフレーズ空で実行)
    const result = await executeCommand({
      cmd: "ssh-keygen",
      args: ["-t", "ed25519", "-C", accountEmail, "-f", sshKeyPath, "-N", ""],
    });

    if (result.code !== 0) {
      logger.error(`${accountName} 用の鍵生成に失敗しました。`);
      continue;
    }

    // レポート追加
    const pubKeyPath = `${sshKeyPath}.pub`;
    let pubKeyContent = "公開鍵が見つかりません。";
    if (await fsUtil.exists(pubKeyPath)) {
      pubKeyContent = (await fsUtil.readTextFile(pubKeyPath)).trim();
    }

    reportItems.push(`--------------------------------------------------------
■ アカウント: ${accountName}
【重要】GitHubでこのアカウントにログインしていることを確認してください！
登録先URL: https://github.com/settings/ssh/new

${pubKeyContent}
--------------------------------------------------------`);

    // ssh config 構成
    if (!(await fsUtil.exists(sshConfig))) {
      await fsUtil.writeTextFile(sshConfig, "");
    }
    
    const configContent = await fsUtil.readTextFile(sshConfig);
    if (configContent.includes(`Host ${hostAlias}`)) {
      console.log(`Info: ${hostAlias} は既に SSH 設定に存在します。`);
    } else {
      console.log(`SSH エイリアスを構成中: ${hostAlias} ...`);
      const aliasConfig = `\n# Harness managed identity: ${accountName}\nHost ${hostAlias}\n    HostName github.com\n    User git\n    IdentityFile ${sshKeyPath}\n`;
      await Deno.writeTextFile(sshConfig, configContent + aliasConfig);
      console.log(`Success: ${hostAlias} を ${sshConfig} に追加しました。`);
    }
  }

  // 最終レポート
  if (reportItems.length > 0) {
    console.log("\n=== 以下の公開鍵を GitHub に登録してください ===");
    console.log("※ 複数のアカウントがある場合、一つずつブラウザでログインし直す必要があります。");
    for (const item of reportItems) {
      console.log(item);
    }
    console.log("\n登録後、以下のコマンドでテストを行ってください：");
    console.log("ssh -T github.com-[アカウント名]");
  } else {
    console.log("新規に作成された鍵はありません。すべての構成は最新です。");
  }

  console.log("--------------------------------------------------------");
  console.log("アイデンティティ登録処理が完了しました。");
}

if (import.meta.main) {
  main();
}
