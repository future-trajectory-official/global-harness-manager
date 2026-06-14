export interface LabelPrefixOptions {
  prefix: string;
}

/** ラベル一覧にプレフィックスを適用する。既にプレフィックスを持つか ":" を含むラベルはそのまま。 */
export function applyLabelPrefix(labels: string[], prefix: string): string[] {
  return labels.map((label) => {
    if (label.startsWith(prefix)) return label;
    if (label.includes(":")) return label;
    return `${prefix}${label}`;
  });
}

/** ラベル一覧からプレフィックスを除去する。 */
export function stripLabelPrefix(labels: string[], prefix: string): string[] {
  return labels.map((label) => {
    if (label.startsWith(prefix)) return label.slice(prefix.length);
    return label;
  });
}

/** 指定したプレフィックスに一致するラベルのみ抽出する。 */
export function filterLabelsByPrefix(labels: string[], prefix: string): string[] {
  return labels.filter((label) => label.startsWith(prefix));
}
