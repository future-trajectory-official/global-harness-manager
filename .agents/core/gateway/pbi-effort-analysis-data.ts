export class PbiEffortAnalysisData {
  static validate(json: string): { valid: boolean; error?: string } {
    try {
      JSON.parse(json);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Invalid JSON format: ${e}` };
    }
  }

  static parseField(json: string, field: string): unknown {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      return parsed[field];
    } catch {
      return undefined;
    }
  }
}
