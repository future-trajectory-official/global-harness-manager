import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const ROOT = Deno.cwd();

Deno.test("Markdown Link and Path Resolution Verification", async () => {
  const issues: string[] = [];
  const mdFiles: string[] = [];

  // .agents ディレクトリ配下の markdown ファイルを走査
  for await (const entry of walk(`${ROOT}/.agents`, { exts: [".md"] })) {
    if (entry.isFile) {
      mdFiles.push(entry.path);
    }
  }

  // ルールやスキルなどのファイル名リスト（プレーンテキスト言及の検出用）
  const knownFiles = [
    "product-backlog.md",
    "backlog-guidelines.md",
    "VISION.md",
    "epic-master.md",
    "architect.md",
    "developer.md",
    "scrum-master.md",
    "tester.md",
    "refactor.md",
    "version-control-specialist.md",
    "platform-engineer.md",
    "po-coach.md",
    "technical-advisor.md",
    "debugger.md",
    "documentation-writer.md",
    "consultant.md",
    "devils-advocate.md",
    "investor.md",
    "prompt-engineer.md",
    "skill-writer.md",
    "designer.md",
    "README.md",
  ];

  for (const filePath of mdFiles) {
    const content = await Deno.readTextFile(filePath);
    const relativePath = filePath.replace(ROOT, "");

    // コードブロック (```...```) とインラインコード (`...`) を除外したコンテンツを作成
    // テスト走査での誤検知を防ぐため
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]+`/g, "");

    // 1. 絶対パスのチェック (/home/tsumugi/global-harness-manager/ など)
    const absolutePathRegex = /\/home\/tsumugi\/global-harness-manager\/[^\s\)]*/g;
    let match;
    while ((match = absolutePathRegex.exec(cleanContent)) !== null) {
      // プレーンテキスト言及の検出での重複を避けるため、正規表現がファイルパスを含んでいないかチェック
      issues.push(`[Absolute Path] In ${relativePath}: Found absolute path "${match[0]}"`);
    }

    // 2. カレント相対パスのチェック (SKILL.md や rules/ 配下での ../ や ../../ などの不適切な相対パス)
    if (filePath.includes("/skills/") || filePath.includes("/rules/")) {
      const parentRelativeRegex = /\]\((file:\/\/)?(\.\.\/)+[^\s\)]*\)/g;
      while ((match = parentRelativeRegex.exec(cleanContent)) !== null) {
        issues.push(
          `[Skill-Relative Path] In ${relativePath}: Found relative path targeting parent directory "${
            match[0]
          }" which breaks in global skills.`,
        );
      }
    }

    // 3. リンク切れチェック
    // Markdown リンク of: [text](link) または ![image](link)
    const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;
    while ((match = linkRegex.exec(cleanContent)) !== null) {
      const link = match[1];

      // 外部URLや内部アンカー (#) は除外
      if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("#")) {
        continue;
      }

      // パスのクリーンアップと解決
      let targetPath = link;
      let isWorkspaceRelative = false;
      if (targetPath.startsWith("file://")) {
        targetPath = targetPath.slice(7); // "file://" の除去
        isWorkspaceRelative = true;
        // file:/// のスリースラッシュ対応
        if (targetPath.startsWith("/")) {
          targetPath = targetPath.slice(1);
          // もし absolute path だったら isWorkspaceRelative を false に戻す
          if (targetPath.startsWith("home/")) {
            targetPath = "/" + targetPath;
            isWorkspaceRelative = false;
          }
        }
      }

      let absoluteTarget = "";
      if (targetPath.startsWith("/")) {
        // 絶対パスの場合
        absoluteTarget = targetPath;
      } else {
        // 相対パスの場合
        if (isWorkspaceRelative || targetPath.startsWith(".agents/")) {
          // ワークスペースルートからの相対
          absoluteTarget = `${ROOT}/${targetPath}`;
        } else {
          // 現在のファイルからの相対
          const currentDir = filePath.substring(0, filePath.lastIndexOf("/"));
          absoluteTarget = `${currentDir}/${targetPath}`;
        }
      }

      // アンカー部分 (#) を除外して実ファイルパスを取得
      const hashIndex = absoluteTarget.indexOf("#");
      if (hashIndex !== -1) {
        absoluteTarget = absoluteTarget.substring(0, hashIndex);
      }

      // デコード (URLエンコードされた文字などの復元)
      try {
        absoluteTarget = decodeURIComponent(absoluteTarget);
      } catch {
        // デコード失敗時はそのまま
      }

      // ファイルの存在確認 (実ファイルまたは.exampleテンプレートが存在すれば有効とする)
      let exists = false;
      try {
        const stats = await Deno.stat(absoluteTarget);
        if (stats.isFile || stats.isDirectory) {
          exists = true;
        }
      } catch {
        // CI環境など実ファイルが除外されている場合は.exampleの存在を以て救済
        try {
          const exampleStats = await Deno.stat(absoluteTarget + ".example");
          if (exampleStats.isFile) {
            exists = true;
          }
        } catch {
          // それでもなければ不合格
        }
      }

      if (!exists) {
        issues.push(
          `[Dead Link] In ${relativePath}: Dead link found "${link}". Target file "${absoluteTarget}" does not exist.`,
        );
      }
    }

    // 4. プレーンテキスト言及の検出
    for (const knownFile of knownFiles) {
      const escapedFile = knownFile.replace(".", "\\.");
      // 既にリンクされているか、file:// の一部であるか、コードブロック内などの単純言及か
      // 簡易的に前後文字を検証
      const plaintextRegex = new RegExp(
        `(?<!\\[)(?<!file:\\/\\/\\/?[^\\s\\)]*)${escapedFile}(?!\\])`,
        "g",
      );

      let textMatch;
      while ((textMatch = plaintextRegex.exec(cleanContent)) !== null) {
        // 検出した場所がURLやリンクの一部でないか念のため検証
        const index = textMatch.index;
        const sub = cleanContent.substring(
          Math.max(0, index - 20),
          Math.min(cleanContent.length, index + knownFile.length + 20),
        );

        // 簡単な除外ロジック (リンク記法 [text](path) の path 側に含まれている場合は除外)
        if (
          sub.includes(`](${knownFile}`) || sub.includes(`](${knownFile}#`) ||
          sub.includes(`/` + knownFile)
        ) {
          continue;
        }

        issues.push(
          `[Unlinked Text] In ${relativePath}: Found plaintext mention of "${knownFile}" at index ${textMatch.index}. Please convert to a relative markdown link.`,
        );
      }
    }
  }

  // 課題を表示
  if (issues.length > 0) {
    console.log(`\nFound ${issues.length} markdown/link issues:\n`);
    issues.forEach((issue) => console.log(`  ${issue}`));
  }

  assertEquals(issues.length, 0, `There are ${issues.length} link/path issues to resolve.`);
});
