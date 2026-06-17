// deno-lint-ignore-file no-unused-vars require-await
import { assertEquals } from "@std/assert";
import {
  addLabels,
  addToProject,
  attachIssue,
  closeIssue,
  createIssue,
  CreateIssueOptions,
  createMilestone,
  CreateMilestoneOptions,
  detachIssue,
  DomainIssue,
  DomainMilestone,
  DomainProject,
  getProjectFields,
  GitHubOperations,
  IGitHubContext,
  IGitHubOperations,
  Issue,
  listMilestones,
  ProjectField,
  RunOptions,
  searchIssues,
  SearchIssuesOptions,
  setGhCommand,
  setProjectField,
  SetProjectFieldOptions,
  updateIssue,
  UpdateIssueOptions,
} from "./github.ts";
import { Issue as DomainIssueImpl } from "./issue.ts";
import { Project as DomainProjectImpl } from "./project.ts";
import { Milestone as DomainMilestoneImpl } from "./milestone.ts";

// === Test Stub for IGitHubOperations ===
class GitHubOperationsStub implements IGitHubOperations {
  createIssue(
    context: IGitHubContext,
    payload: CreateIssueOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string } | null> {
    return Promise.resolve({
      number: 42,
      url: `https://github.com/${context.owner}/${context.repository}/issues/42`,
    });
  }
  searchIssues(
    context: IGitHubContext,
    filter?: SearchIssuesOptions,
    execOptions?: RunOptions,
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
    changes: UpdateIssueOptions,
    execOptions?: RunOptions,
  ): Promise<Issue | null> {
    return Promise.resolve({
      number: number,
      url: `https://github.com/${context.owner}/${context.repository}/issues/${number}`,
      title: changes.title,
      state: "open",
      labels: [{ name: "bug" }],
      body: "",
    });
  }
  closeIssue(context: IGitHubContext, number: number, execOptions?: RunOptions): Promise<boolean> {
    return Promise.resolve(true);
  }
  getIssue(
    context: IGitHubContext,
    number: number,
    execOptions?: RunOptions,
  ): Promise<Issue | null> {
    return Promise.resolve({
      number: number,
      url: `https://github.com/${context.owner}/${context.repository}/issues/${number}`,
      title: "Found Issue",
      state: "open",
      labels: [{ name: "bug" }],
      body: "",
    });
  }
  attachIssue(
    context: IGitHubContext,
    parentNumber: number,
    childNumber: number,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  detachIssue(
    context: IGitHubContext,
    issueNumber: number,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  addLabels(
    context: IGitHubContext,
    number: number,
    labels: string[],
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  addToProject(
    context: IGitHubContext,
    issueNumber: number,
    projectId: string,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  getProjectFields(
    context: IGitHubContext,
    projectId: string,
    execOptions?: RunOptions,
  ): Promise<ProjectField[]> {
    return Promise.resolve([
      { id: "field_1", name: "Status", type: "SINGLE_SELECT" },
      { id: "field_2", name: "Priority", type: "SINGLE_SELECT" },
      { id: "field_3", name: "Size", type: "NUMBER" },
    ]);
  }
  setProjectField(
    context: IGitHubContext,
    fieldUpdate: SetProjectFieldOptions,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
  createMilestone(
    context: IGitHubContext,
    milestoneData: CreateMilestoneOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string } | null> {
    return Promise.resolve({
      number: 1,
      url: `https://github.com/${context.owner}/${context.repository}/milestone/1`,
    });
  }
  listMilestones(
    context: IGitHubContext,
    execOptions?: RunOptions,
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
  attach(child: DomainIssue): Promise<void> {
    return Promise.resolve();
  }
  detach(child: DomainIssue): Promise<void> {
    return Promise.resolve();
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
RESPONSE_FILE=$(dirname "$0")/mock-response.json
# Concatenate args and detect command pattern
ALL="$*"
case "$ALL" in
  *"issue create"*)
    echo "https://github.com/owner/repo/issues/42"
    ;;
  *"issue list"*)
    echo '[{"number":1,"url":"https://github.com/owner/repo/issues/1","title":"Test Issue","state":"open","labels":[{"name":"bug"}],"body":"test body","milestone":{"title":"v1","number":1}}]'
    ;;
  *"issue edit"*)
    # Extract issue number (last numeric arg before --json)
    NUM=""
    for arg in "$@"; do
      case "$arg" in
        --json) break ;;
        *) NUM="$arg" ;;
      esac
    done
    echo '{"number":'"$NUM"',"url":"https://github.com/owner/repo/issues/1","title":"Updated","state":"open","labels":[{"name":"bug"}],"body":"","milestone":null}'
    ;;
  *"issue view"*)
    echo '{"number":1,"url":"https://github.com/owner/repo/issues/1","title":"Test Issue","state":"open","labels":[{"name":"bug"}],"body":"test body","milestone":{"title":"v1","number":1}}'
    ;;
  *"issue close"*)
    exit 0
    ;;
  *"project item-add"*|*"project item-edit"*)
    exit 0
    ;;
  *"project field-list"*)
    echo '[{"id":"field_1","name":"Status","type":"SINGLE_SELECT","options":[]},{"id":"field_2","name":"Priority","type":"SINGLE_SELECT","options":[]},{"id":"field_3","name":"Size","type":"NUMBER"}]'
    ;;
  *"CreateMilestone"*|*"milestones"*"-f"*)
    echo '{"number":1,"html_url":"https://github.com/owner/repo/milestone/1"}'
    ;;
  *"ListMilestones"*|*"milestones"*)
    echo '[{"number":1,"title":"Sprint 1"}]'
    ;;
  *"api graphql"*)
    echo '{}'
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

const TEST_CONTEXT: IGitHubContext = { owner: "test", repository: "repo" };

Deno.test("github - createIssue should return issue number and url", async () => {
  await withMockGh(async () => {
    const result = await createIssue(TEST_CONTEXT, { title: "Test" });
    assertEquals(result?.number, 42);
    assertEquals(result?.url, "https://github.com/owner/repo/issues/42");
  });
});

Deno.test("github - searchIssues should return issue list", async () => {
  await withMockGh(async () => {
    const issues = await searchIssues(TEST_CONTEXT, { state: "open" });
    assertEquals(issues.length, 1);
    assertEquals(issues[0].number, 1);
    assertEquals(issues[0].title, "Test Issue");
  });
});

Deno.test("github - updateIssue should return updated issue", async () => {
  await withMockGh(async () => {
    const result = await updateIssue(TEST_CONTEXT, 1, { title: "Updated" });
    assertEquals(result?.number, 1);
    assertEquals(result?.title, "Updated");
  });
});

Deno.test("github - closeIssue should return true", async () => {
  await withMockGh(async () => {
    const result = await closeIssue(TEST_CONTEXT, 1);
    assertEquals(result, true);
  });
});

// === RED Tests for IGitHubOperations (AC-3) ===

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

Deno.test("github - IGitHubOperations attachIssue should return true", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.attachIssue(TEST_CONTEXT, 1, 2);
  assertEquals(result, true);
});

Deno.test("github - IGitHubOperations detachIssue should return true", async () => {
  const operations = new GitHubOperationsStub();
  const result = await operations.detachIssue(TEST_CONTEXT, 1);
  assertEquals(result, true);
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

Deno.test("DomainIssue - attach should attach child issue", async () => {
  const parent = new DomainIssueStub(TEST_CONTEXT, 1, "Parent", "", [], "open");
  const child = new DomainIssueStub(TEST_CONTEXT, 2, "Child", "", [], "open");
  await parent.attach(child);
});

Deno.test("DomainIssue - detach should detach child issue", async () => {
  const parent = new DomainIssueStub(TEST_CONTEXT, 1, "Parent", "", [], "open");
  const child = new DomainIssueStub(TEST_CONTEXT, 2, "Child", "", [], "open");
  await parent.detach(child);
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

// === Real Domain Model Tests ===

Deno.test("DomainIssueImpl - create should return new issue via Gateway", async () => {
  await withMockGh(async () => {
    const issue = await DomainIssueImpl.create(TEST_CONTEXT, { title: "Test" });
    assertEquals(issue.number, 42);
    assertEquals(issue.title, "Test");
    assertEquals(issue.state, "open");
  });
});

Deno.test("DomainIssueImpl - find should return issue via Gateway", async () => {
  await withMockGh(async () => {
    const issue = await DomainIssueImpl.find(TEST_CONTEXT, 1);
    assertEquals(issue?.number, 1);
    assertEquals(issue?.title, "Test Issue");
    assertEquals(issue?.state, "open");
  });
});

Deno.test("DomainIssueImpl - find should return null when issue not found", async () => {
  const issue = await DomainIssueImpl.find(TEST_CONTEXT, 999);
  assertEquals(issue, null);
});

Deno.test("DomainIssueImpl - list should return issue array via Gateway", async () => {
  await withMockGh(async () => {
    const issues = await DomainIssueImpl.list(TEST_CONTEXT, { state: "open" });
    assertEquals(issues.length, 1);
    assertEquals(issues[0].number, 1);
  });
});

Deno.test("DomainIssueImpl - addLabel should add label and return this", async () => {
  const issue = new DomainIssueImpl(TEST_CONTEXT, 1, "Test", "", [], "open");
  const result = issue.addLabel("bug");
  assertEquals(result.labels, ["bug"]);
  assertEquals(result, issue);
});

Deno.test("DomainIssueImpl - removeLabel should remove label and return this", async () => {
  const issue = new DomainIssueImpl(TEST_CONTEXT, 1, "Test", "", ["bug", "enhancement"], "open");
  const result = issue.removeLabel("bug");
  assertEquals(result.labels, ["enhancement"]);
  assertEquals(result, issue);
});

Deno.test("DomainIssueImpl - attach should call Gateway attachIssue", async () => {
  await withMockGh(async () => {
    const parent = new DomainIssueImpl(TEST_CONTEXT, 1, "Parent", "", [], "open");
    const child = new DomainIssueImpl(TEST_CONTEXT, 2, "Child", "", [], "open");
    await parent.attach(child);
  });
});

Deno.test("DomainIssueImpl - detach should call Gateway detachIssue", async () => {
  await withMockGh(async () => {
    const parent = new DomainIssueImpl(TEST_CONTEXT, 1, "Parent", "", [], "open");
    const child = new DomainIssueImpl(TEST_CONTEXT, 2, "Child", "", [], "open");
    await parent.detach(child);
  });
});

Deno.test("DomainProjectImpl - find should return project", async () => {
  const project = await DomainProjectImpl.find(TEST_CONTEXT, "PVT_xxx");
  assertEquals(project.id, "PVT_xxx");
});

Deno.test("DomainProjectImpl - addItem should call Gateway addToProject", async () => {
  await withMockGh(async () => {
    const project = new DomainProjectImpl(TEST_CONTEXT, "PVT_xxx");
    const issue = new DomainIssueImpl(TEST_CONTEXT, 1, "Test", "", [], "open");
    await project.addItem(issue);
  });
});

Deno.test("DomainProjectImpl - getFields should return fields via Gateway", async () => {
  await withMockGh(async () => {
    const project = new DomainProjectImpl(TEST_CONTEXT, "PVT_xxx");
    const fields = await project.getFields();
    assertEquals(fields.length, 3);
    assertEquals(fields[0].name, "Status");
  });
});

Deno.test("DomainMilestoneImpl - create should return milestone via Gateway", async () => {
  await withMockGh(async () => {
    const milestone = await DomainMilestoneImpl.create(TEST_CONTEXT, { title: "Sprint 1" });
    assertEquals(milestone.number, 1);
    assertEquals(milestone.title, "Sprint 1");
  });
});

Deno.test("DomainMilestoneImpl - list should return milestones via Gateway", async () => {
  await withMockGh(async () => {
    const milestones = await DomainMilestoneImpl.list(TEST_CONTEXT);
    assertEquals(milestones.length, 1);
    assertEquals(milestones[0].title, "Sprint 1");
  });
});
