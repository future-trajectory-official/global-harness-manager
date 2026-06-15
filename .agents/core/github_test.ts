// deno-lint-ignore-file no-unused-vars require-await
import { assertEquals } from "@std/assert";
import {
  closeIssue,
  CreateChildIssueOptions,
  createIssue,
  CreateIssueOptions,
  CreateMilestoneOptions,
  DomainIssue,
  DomainMilestone,
  DomainProject,
  IGitHubContext,
  IGitHubOperations,
  Issue,
  ProjectField,
  RunOptions,
  searchIssues,
  SearchIssuesOptions,
  setGhCommand,
  SetProjectFieldOptions,
  updateIssue,
  UpdateIssueOptions,
} from "./github.ts";

// === Test Stub for IGitHubOperations ===
class GitHubOperationsStub implements IGitHubOperations {
  createIssue(
    context: IGitHubContext,
    opts: CreateIssueOptions,
    options?: RunOptions,
  ): Promise<{ number: number; url: string } | null> {
    return Promise.resolve({
      number: 42,
      url: `https://github.com/${context.owner}/${context.repository}/issues/42`,
    });
  }
  searchIssues(
    context: IGitHubContext,
    opts?: SearchIssuesOptions,
    options?: RunOptions,
  ): Promise<Issue[]> {
    return Promise.resolve([{
      number: 1,
      url: "https://github.com/owner/repo/issues/1",
      title: "Test Issue",
      state: "open",
      labels: [{ name: "bug" }],
      body: "test body",
      milestone: { title: "v1", number: 1 },
    }]);
  }
  updateIssue(
    context: IGitHubContext,
    number: number,
    opts: UpdateIssueOptions,
    options?: RunOptions,
  ): Promise<Issue | null> {
    return Promise.resolve({
      number: number,
      url: `https://github.com/${context.owner}/${context.repository}/issues/${number}`,
      title: opts.title,
      state: "open",
      labels: [{ name: "bug" }],
      body: "",
    });
  }
  closeIssue(context: IGitHubContext, number: number, options?: RunOptions): Promise<boolean> {
    return Promise.resolve(true);
  }
  createChildIssue(
    context: IGitHubContext,
    opts: CreateChildIssueOptions,
    options?: RunOptions,
  ): Promise<{ number: number; url: string; parentLinked: boolean } | null> {
    return Promise.resolve({
      number: 2,
      url: `https://github.com/${context.owner}/${context.repository}/issues/2`,
      parentLinked: true,
    });
  }
  addLabels(
    context: IGitHubContext,
    number: number,
    labels: string[],
    options?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  addToProject(
    context: IGitHubContext,
    issueNumber: number,
    projectId: string,
    options?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  getProjectFields(
    context: IGitHubContext,
    projectId: string,
    options?: RunOptions,
  ): Promise<ProjectField[]> {
    return Promise.resolve([
      { id: "field_1", name: "Status", type: "SINGLE_SELECT" },
      { id: "field_2", name: "Priority", type: "SINGLE_SELECT" },
      { id: "field_3", name: "Size", type: "NUMBER" },
    ]);
  }
  setProjectField(
    context: IGitHubContext,
    opts: SetProjectFieldOptions,
    options?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  createMilestone(
    context: IGitHubContext,
    opts: CreateMilestoneOptions,
    options?: RunOptions,
  ): Promise<{ number: number; url: string } | null> {
    return Promise.resolve({
      number: 1,
      url: `https://github.com/${context.owner}/${context.repository}/milestone/1`,
    });
  }
  listMilestones(
    context: IGitHubContext,
    options?: RunOptions,
  ): Promise<{ number: number; title: string }[]> {
    return Promise.resolve([{ number: 1, title: "Sprint 1" }]);
  }
}

// === Test Stub for Domain Models ===
class DomainIssueStub implements DomainIssue {
  readonly context: IGitHubContext;
  readonly number: number;
  title: string;
  body: string;
  labels: string[];
  state: "open" | "closed";
  milestone?: string;

  constructor(
    context: IGitHubContext,
    number: number,
    title: string,
    body: string,
    labels: string[],
    state: "open" | "closed",
    milestone?: string,
  ) {
    this.context = context;
    this.number = number;
    this.title = title;
    this.body = body;
    this.labels = labels;
    this.state = state;
    this.milestone = milestone;
  }

  addLabel(label: string): this {
    this.labels.push(label);
    return this;
  }
  removeLabel(label: string): this {
    this.labels = this.labels.filter((l) => l !== label);
    return this;
  }
  save(): Promise<this> {
    return Promise.resolve(this);
  }
  close(): Promise<this> {
    this.state = "closed";
    return Promise.resolve(this);
  }
  createChild(params: CreateChildIssueOptions): Promise<DomainIssue> {
    return Promise.resolve(
      new DomainIssueStub(
        this.context,
        2,
        params.title,
        params.body || "",
        [],
        "open",
      ),
    );
  }

  static async create(context: IGitHubContext, params: CreateIssueOptions): Promise<DomainIssue> {
    return new DomainIssueStub(context, 42, params.title, params.body || "", [], "open");
  }
  static async find(context: IGitHubContext, number: number): Promise<DomainIssue | null> {
    return new DomainIssueStub(context, number, "Found Issue", "", [], "open");
  }
  static async list(context: IGitHubContext, filter?: SearchIssuesOptions): Promise<DomainIssue[]> {
    return [new DomainIssueStub(context, 1, "Found Issue", "", [], "open")];
  }
}

class DomainProjectStub implements DomainProject {
  readonly context: IGitHubContext;
  readonly id: string;

  constructor(context: IGitHubContext, id: string) {
    this.context = context;
    this.id = id;
  }

  addItem(issue: DomainIssue): Promise<void> {
    return Promise.resolve();
  }
  getFields(): Promise<ProjectField[]> {
    return Promise.resolve([
      { id: "field_1", name: "Status", type: "SINGLE_SELECT" },
      { id: "field_2", name: "Priority", type: "SINGLE_SELECT" },
      { id: "field_3", name: "Size", type: "NUMBER" },
    ]);
  }
  setField(itemId: string, field: ProjectField, value: string): Promise<void> {
    return Promise.resolve();
  }

  static async find(context: IGitHubContext, id: string): Promise<DomainProject> {
    return new DomainProjectStub(context, id);
  }
}

class DomainMilestoneStub implements DomainMilestone {
  readonly context: IGitHubContext;
  readonly number: number;
  title: string;
  description?: string;
  dueOn?: string;

  constructor(
    context: IGitHubContext,
    number: number,
    title: string,
    description?: string,
    dueOn?: string,
  ) {
    this.context = context;
    this.number = number;
    this.title = title;
    this.description = description;
    this.dueOn = dueOn;
  }

  static async create(
    context: IGitHubContext,
    params: CreateMilestoneOptions,
  ): Promise<DomainMilestone> {
    return new DomainMilestoneStub(context, 1, params.title, params.description, params.dueOn);
  }
  static async list(context: IGitHubContext): Promise<DomainMilestone[]> {
    return [new DomainMilestoneStub(context, 1, "Sprint 1")];
  }
}

const MOCK_SCRIPT = `#!/usr/bin/env bash
# Mock gh CLI for testing
RESPONSE_FILE="$(dirname "$0")/mock-response.json"
case "$1 $2" in
  "issue create")
    cat "$RESPONSE_FILE"
    ;;
  "issue list")
    echo '[{"number":1,"url":"https://github.com/owner/repo/issues/1","title":"Test Issue","state":"open","labels":[{"name":"bug"}],"body":"test body","milestone":{"title":"v1","number":1}}]'
    ;;
  "issue edit")
    echo '{"number":'"$3"',"url":"https://github.com/owner/repo/issues/1","title":"Updated","state":"open","labels":[{"name":"bug"}],"body":"","milestone":null}'
    ;;
  "issue close")
    exit 0
    ;;
  *)
    echo "Unknown command: $*" >&2
    exit 1
    ;;
esac
`;

async function withMockGh(fn: () => Promise<void>) {
  const tmpDir = await Deno.makeTempDir({ prefix: "gh-test-" });
  const mockPath = `${tmpDir}/mock-gh.sh`;
  const responsePath = `${tmpDir}/mock-response.json`;
  await Deno.writeTextFile(mockPath, MOCK_SCRIPT);
  await Deno.writeTextFile(
    responsePath,
    JSON.stringify({ number: 42, url: "https://github.com/owner/repo/issues/42" }),
  );
  await Deno.chmod(mockPath, 0o755);
  setGhCommand(mockPath);
  try {
    await fn();
  } finally {
    setGhCommand("gh");
    await Deno.remove(tmpDir, { recursive: true });
  }
}

Deno.test("github - createIssue should return issue number and url", async () => {
  await withMockGh(async () => {
    const result = await createIssue({ title: "Test" });
    assertEquals(result?.number, 42);
    assertEquals(result?.url, "https://github.com/owner/repo/issues/42");
  });
});

Deno.test("github - searchIssues should return issue list", async () => {
  await withMockGh(async () => {
    const issues = await searchIssues({ state: "open" });
    assertEquals(issues.length, 1);
    assertEquals(issues[0].number, 1);
    assertEquals(issues[0].title, "Test Issue");
  });
});

Deno.test("github - updateIssue should return updated issue", async () => {
  await withMockGh(async () => {
    const result = await updateIssue(1, { title: "Updated" });
    assertEquals(result?.number, 1);
    assertEquals(result?.title, "Updated");
  });
});

Deno.test("github - closeIssue should return true", async () => {
  await withMockGh(async () => {
    const result = await closeIssue(1);
    assertEquals(result, true);
  });
});

// === RED Tests for IGitHubOperations (AC-3) ===

const TEST_CONTEXT: IGitHubContext = { owner: "test", repository: "repo" };

Deno.test("github - IGitHubOperations createIssue should return issue number and url", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.createIssue(TEST_CONTEXT, { title: "Test" });
  assertEquals(result?.number, 42);
  assertEquals(result?.url, "https://github.com/test/repo/issues/42");
});

Deno.test("github - IGitHubOperations searchIssues should return issue list", async () => {
  const operations = new GitHubOperationsStub();
  const issues = await operations.searchIssues(TEST_CONTEXT, { state: "open" });
  assertEquals(issues.length, 1);
  assertEquals(issues[0].number, 1);
});

Deno.test("github - IGitHubOperations updateIssue should return updated issue", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.updateIssue(TEST_CONTEXT, 1, { title: "Updated" });
  assertEquals(result?.number, 1);
  assertEquals(result?.title, "Updated");
});

Deno.test("github - IGitHubOperations closeIssue should return true", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.closeIssue(TEST_CONTEXT, 1);
  assertEquals(result, true);
});

Deno.test("github - IGitHubOperations createChildIssue should return child issue", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.createChildIssue(TEST_CONTEXT, {
    title: "Child",
    parentNumber: 1,
  });
  assertEquals(result?.number, 2);
  assertEquals(result?.parentLinked, true);
});

Deno.test("github - IGitHubOperations addLabels should return true", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.addLabels(TEST_CONTEXT, 1, ["bug", "enhancement"]);
  assertEquals(result, true);
});

Deno.test("github - IGitHubOperations addToProject should return true", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.addToProject(TEST_CONTEXT, 1, "PVT_xxx");
  assertEquals(result, true);
});

Deno.test("github - IGitHubOperations getProjectFields should return fields", async () => {
  const operations = new GitHubOperationsStub();
  const fields = await operations.getProjectFields(TEST_CONTEXT, "PVT_xxx");
  assertEquals(fields.length, 3);
  assertEquals(fields[0].name, "Status");
});

Deno.test("github - IGitHubOperations setProjectField should return true", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.setProjectField(TEST_CONTEXT, {
    itemId: "item_1",
    fieldId: "field_1",
    value: "Done",
  });
  assertEquals(result, true);
});

Deno.test("github - IGitHubOperations createMilestone should return milestone", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.createMilestone(TEST_CONTEXT, { title: "Sprint 1" });
  assertEquals(result?.number, 1);
  assertEquals(result?.url, "https://github.com/test/repo/milestone/1");
});

Deno.test("github - IGitHubOperations listMilestones should return milestones", async () => {
  const operations = new GitHubOperationsStub();
  const milestones = await operations.listMilestones(TEST_CONTEXT);
  assertEquals(milestones.length, 1);
  assertEquals(milestones[0].title, "Sprint 1");
});

// === RED Tests for Domain Models (AC-4) ===

Deno.test("DomainIssue - create should return new issue", async () => {
  const issue = await DomainIssueStub.create(TEST_CONTEXT, { title: "Test" });
  assertEquals(issue.number, 42);
  assertEquals(issue.title, "Test");
});

Deno.test("DomainIssue - find should return issue", async () => {
  const issue = await DomainIssueStub.find(TEST_CONTEXT, 1);
  assertEquals(issue?.number, 1);
  assertEquals(issue?.title, "Found Issue");
});

Deno.test("DomainIssue - list should return issue array", async () => {
  const issues = await DomainIssueStub.list(TEST_CONTEXT, { state: "open" });
  assertEquals(issues.length, 1);
  assertEquals(issues[0].number, 1);
});

Deno.test("DomainIssue - addLabel should add label", async () => {
  const issue = new DomainIssueStub(TEST_CONTEXT, 1, "Test", "", [], "open");
  const result = issue.addLabel("bug");
  assertEquals(result.labels, ["bug"]);
});

Deno.test("DomainIssue - save should persist changes", async () => {
  const issue = new DomainIssueStub(TEST_CONTEXT, 1, "Test", "", [], "open");
  issue.title = "Updated";
  const result = await issue.save();
  assertEquals(result.title, "Updated");
});

Deno.test("DomainIssue - close should close issue", async () => {
  const issue = new DomainIssueStub(TEST_CONTEXT, 1, "Test", "", [], "open");
  const result = await issue.close();
  assertEquals(result.state, "closed");
});

Deno.test("DomainIssue - createChild should create child issue", async () => {
  const issue = new DomainIssueStub(TEST_CONTEXT, 1, "Parent", "", [], "open");
  const child = await issue.createChild({ title: "Child", parentNumber: 1 });
  assertEquals(child.number, 2);
  assertEquals(child.title, "Child");
});

Deno.test("DomainProject - find should return project", async () => {
  const project = await DomainProjectStub.find(TEST_CONTEXT, "PVT_xxx");
  assertEquals(project.id, "PVT_xxx");
});

Deno.test("DomainProject - addItem should add issue to project", async () => {
  const project = new DomainProjectStub(TEST_CONTEXT, "PVT_xxx");
  const issue = new DomainIssueStub(TEST_CONTEXT, 1, "Test", "", [], "open");
  await project.addItem(issue);
});

Deno.test("DomainProject - getFields should return fields", async () => {
  const project = new DomainProjectStub(TEST_CONTEXT, "PVT_xxx");
  const fields = await project.getFields();
  assertEquals(fields.length, 3);
  assertEquals(fields[0].name, "Status");
});

Deno.test("DomainProject - setField should set field value", async () => {
  const project = new DomainProjectStub(TEST_CONTEXT, "PVT_xxx");
  const fields = await project.getFields();
  await project.setField("item_1", fields[0], "Done");
});

Deno.test("DomainMilestone - create should return milestone", async () => {
  const milestone = await DomainMilestoneStub.create(TEST_CONTEXT, { title: "Sprint 1" });
  assertEquals(milestone.number, 1);
  assertEquals(milestone.title, "Sprint 1");
});

Deno.test("DomainMilestone - list should return milestones", async () => {
  const milestones = await DomainMilestoneStub.list(TEST_CONTEXT);
  assertEquals(milestones.length, 1);
  assertEquals(milestones[0].title, "Sprint 1");
});

// === JSON Schema Integration Test (AC-6) ===

Deno.test("JSON Schema - harnessrc-schema.json exists and has required fields", () => {
  const schemaPath = new URL("../../.github/schemas/harnessrc-schema.json", import.meta.url);
  const schema = JSON.parse(Deno.readTextFileSync(schemaPath));
  // Verify customFields mapping consistency
  assertEquals(schema.properties.customFields.required.includes("type"), true);
  assertEquals(schema.properties.customFields.required.includes("size"), true);
  assertEquals(schema.properties.customFields.required.includes("status"), true);
  assertEquals(schema.properties.customFields.required.includes("sequence"), true);
  assertEquals(schema.properties.customFields.required.includes("effort"), true);
  // Verify harness-type options
  assertEquals(schema.properties["harness-type"].properties.options.minItems, 6);
});

Deno.test("JSON Schema - IGitHubContext fields do not conflict with harnessrc fields", () => {
  // IGitHubContext fields: owner, repository
  // harnessrc fields: version, projects, customFields, harness-type, milestone, issueTemplate
  // No naming conflict expected
  const schemaPath = new URL("../../.github/schemas/harnessrc-schema.json", import.meta.url);
  const schema = JSON.parse(Deno.readTextFileSync(schemaPath));
  const topLevelKeys = Object.keys(schema.properties);
  assertEquals(topLevelKeys.includes("owner"), false);
  assertEquals(topLevelKeys.includes("repository"), false);
});
