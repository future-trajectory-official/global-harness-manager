import { executeCommand } from "../shared/io/command.ts";
import type {
  BoardOutput,
  ConfigContent,
  EntityScope,
  LabelDefinition,
  List,
} from "../domain/types.ts";
import type { ConfigGateway } from "../domain/config-gateway.ts";

export class ConfigGatewayAdapter implements ConfigGateway {
  constructor(
    private readonly owner: string,
    private readonly repository: string,
  ) {}

  async resolveScope(): Promise<EntityScope> {
    const result = await executeCommand({
      cmd: "gh",
      args: ["repo", "view", "--json", "owner,name"],
    });
    const data = JSON.parse(result.stdout);
    return { owner: data.owner.login, repository: data.name };
  }

  readConfig(source: string): ConfigContent {
    const content = Deno.readTextFileSync(source);
    return { source, content };
  }

  writeConfig(target: string, content: string): void {
    Deno.writeTextFileSync(target, content, { create: true });
  }

  async listBoards(): Promise<List<BoardOutput>> {
    const result = await executeCommand({
      cmd: "gh",
      args: [
        "project",
        "list",
        "--owner",
        this.owner,
        "--format",
        "json",
        "--limit",
        "100",
      ],
    });
    const data = JSON.parse(result.stdout);
    const items = (data.projects ?? []).map(
      (p: { number: number; title: string }): BoardOutput => ({ id: p.number, name: p.title }),
    );
    return { items, totalCount: items.length };
  }

  async createBoard(name: string, owner: string): Promise<BoardOutput> {
    const result = await executeCommand({
      cmd: "gh",
      args: ["project", "create", "--owner", owner, "--title", name, "--format", "json"],
    });
    const data = JSON.parse(result.stdout);
    return { id: data.number, name: data.title };
  }

  async createLabel(label: LabelDefinition): Promise<void> {
    const result = await executeCommand({
      cmd: "gh",
      args: [
        "label",
        "create",
        label.name,
        "--color",
        label.color,
        "--description",
        label.description,
        "--repo",
        `${this.owner}/${this.repository}`,
      ],
    });
    if (result.code !== 0) {
      throw new Error(`GATEWAY_ERROR: Failed to create label '${label.name}': ${result.stderr}`);
    }
  }
}
