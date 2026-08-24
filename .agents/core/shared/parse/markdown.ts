// --- Markdown Utilities ---

export const mdUtil = {
  /**
   * Markdown 内の全ての H2 タイトルを取得します
   */
  getH2Titles: (content: string): string[] => {
    return content
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3).trim());
  },

  /**
   * 特定の H2 セクション配下にある指定レベルのタイトルを取得します
   */
  getTitlesInSection: (content: string, sectionTitle: string, level: 2 | 3): string[] => {
    const sectionLines = getSectionLines(content, sectionTitle);
    const targetPrefix = "#".repeat(level) + " ";

    return sectionLines
      .filter((line) => line.startsWith(targetPrefix))
      .map((line) => line.slice(targetPrefix.length).trim());
  },

  /**
   * 特定の H2 セクション配下にあるリスト項目をパースし、
   * `**Key**: Value` 形式のものをオブジェクトとして返します。
   */
  parseKVListInSection: (content: string, sectionTitle: string): Record<string, string> => {
    const sectionLines = getSectionLines(content, sectionTitle);
    const result: Record<string, string> = {};

    for (const line of sectionLines) {
      if (line.trim().startsWith("- ")) {
        // - **Key**: Value または - **Key**: `Value` 形式を抽出
        const match = line.match(/-\s+\*\*(.+?)\*\*:\s+(.+)/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // バッククォートで囲まれている場合は除去
          if (value.startsWith("`") && value.endsWith("`")) {
            value = value.slice(1, -1);
          }
          result[key] = value;
        }
      }
    }
    return result;
  },
};

/**
 * 特定の H2 セクション配下にある行を抽出します
 */
function getSectionLines(content: string, sectionTitle: string): string[] {
  const lines = content.split("\n");
  const sectionPrefix = "## ";
  let inSection = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith(sectionPrefix)) {
      const currentTitle = line.slice(sectionPrefix.length).trim();
      if (currentTitle === sectionTitle) {
        inSection = true;
        continue;
      } else if (inSection) {
        break;
      }
    }

    if (inSection) {
      result.push(line);
    }
  }
  return result;
}
