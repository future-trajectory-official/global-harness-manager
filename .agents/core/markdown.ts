// --- Markdown Utilities ---

export const mdUtil = {
  /**
   * Markdown 内の全ての H2 タイトルを取得します
   */
  getH2Titles: (content: string): string[] => {
    const lines = content.split("\n");
    return lines
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3).trim());
  },

  /**
   * 特定の H2 セクション配下にある指定レベルのタイトルを取得します
   */
  getTitlesInSection: (
    content: string,
    sectionTitle: string,
    level: 2 | 3,
  ): string[] => {
    const lines = content.split("\n");
    let inSection = false;
    const titles: string[] = [];
    const targetPrefix = "#".repeat(level) + " ";
    const sectionPrefix = "## ";

    for (const line of lines) {
      // 次の H2 が現れたらセクション終了
      if (line.startsWith(sectionPrefix)) {
        const currentTitle = line.slice(sectionPrefix.length).trim();
        if (currentTitle === sectionTitle) {
          inSection = true;
          continue;
        } else if (inSection) {
          break;
        }
      }

      if (inSection && line.startsWith(targetPrefix)) {
        titles.push(line.slice(targetPrefix.length).trim());
      }
    }
    return titles;
  },
};
