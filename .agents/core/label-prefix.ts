export interface LabelPrefixOptions {
  prefix: string;
}

export function applyLabelPrefix(labels: string[], prefix: string): string[] {
  return labels.map((label) => {
    if (label.startsWith(prefix)) return label;
    if (label.includes(":")) return label;
    return `${prefix}${label}`;
  });
}

export function stripLabelPrefix(labels: string[], prefix: string): string[] {
  return labels.map((label) => {
    if (label.startsWith(prefix)) return label.slice(prefix.length);
    return label;
  });
}

export function filterLabelsByPrefix(labels: string[], prefix: string): string[] {
  return labels.filter((label) => label.startsWith(prefix));
}
