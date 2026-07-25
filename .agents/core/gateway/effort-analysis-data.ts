import type { ProcessAnalysis } from "../domain/types.ts";

export interface WpEffortSummary {
  initial_estimate?: number;
  planned_estimate?: number;
  actual?: number;
}

export interface EffortAnalysisJson {
  wp_effort_summary?: WpEffortSummary;
  planning_variance_review?: string;
  execution_variance_review?: string;
  improvement_suggestions?: string;
}

export class EffortAnalysisData {
  private constructor(private data: EffortAnalysisJson) {}

  static empty(): EffortAnalysisData {
    return new EffortAnalysisData({});
  }

  static fromJson(json: string): EffortAnalysisData {
    try {
      const parsed = JSON.parse(json) as EffortAnalysisJson;
      if (parsed.wp_effort_summary) {
        const s = parsed.wp_effort_summary as Record<string, number | undefined>;
        if (s.initialEstimate !== undefined && s.initial_estimate === undefined) {
          s.initial_estimate = s.initialEstimate;
        }
        if (s.plannedEstimate !== undefined && s.planned_estimate === undefined) {
          s.planned_estimate = s.plannedEstimate;
        }
        delete s.initialEstimate;
        delete s.plannedEstimate;
      }
      return new EffortAnalysisData(parsed);
    } catch {
      return EffortAnalysisData.empty();
    }
  }

  toJson(): string {
    return JSON.stringify(this.data);
  }

  mergeEffort(key: keyof WpEffortSummary, value: number): this {
    if (!this.data.wp_effort_summary) {
      this.data.wp_effort_summary = {};
    }
    this.data.wp_effort_summary[key] = value;
    return this;
  }

  mergeAnalysis(analysis: Partial<ProcessAnalysis>): this {
    const mapping: Record<keyof ProcessAnalysis, keyof EffortAnalysisJson> = {
      planningReview: "planning_variance_review",
      executionReview: "execution_variance_review",
      improvementSuggestions: "improvement_suggestions",
    } as const;
    for (const [domainKey, jsonKey] of Object.entries(mapping)) {
      const val = (analysis as Record<string, string | undefined>)[domainKey];
      if (val !== undefined) {
        (this.data as Record<string, string | undefined>)[jsonKey] = val;
      }
    }
    return this;
  }

  get wpEffortSummary(): WpEffortSummary | undefined {
    return this.data.wp_effort_summary;
  }
}
