export interface PbiEffortAnalysisJson {
  size_analysis?: {
    size_estimate?: string;
    size_actual?: string;
    size_variance_review?: string;
  };
  planning_variance_review?: string;
  execution_variance_review?: string;
  improvement_suggestions?: string;
}

export class PbiEffortAnalysisData {
  private constructor(private data: PbiEffortAnalysisJson) {}

  static empty(): PbiEffortAnalysisData {
    return new PbiEffortAnalysisData({});
  }

  static fromJson(json: string): PbiEffortAnalysisData {
    try {
      return new PbiEffortAnalysisData(JSON.parse(json) as PbiEffortAnalysisJson);
    } catch {
      return PbiEffortAnalysisData.empty();
    }
  }

  toJson(): string {
    return JSON.stringify(this.data);
  }

  setSizeVarianceReview(review: string): this {
    if (!this.data.size_analysis) this.data.size_analysis = {};
    this.data.size_analysis.size_variance_review = review;
    return this;
  }

  setAnalysisFields(planningReview?: string, executionReview?: string, suggestions?: string): this {
    if (planningReview) this.data.planning_variance_review = planningReview;
    if (executionReview) this.data.execution_variance_review = executionReview;
    if (suggestions) this.data.improvement_suggestions = suggestions;
    return this;
  }
}
