import { parseArgs } from "@std/cli";
import {
  buildArchiveCard,
  extractPbiBlock,
  loadBacklogSchema,
  updateContents,
} from "../../../../../core/backlog-schema.ts";

const BACKLOG_PATH = ".agents/management/product-backlog.md";
const ARCHIVE_PATH = ".agents/management/product-backlog-archive.md";

async function main() {
  const args = parseArgs(Deno.args);
  const dataRaw = args.data;

  if (!dataRaw) {
    console.error("Usage: deno run -A manage_backlog.ts --data 'JSON_STRING'");
    Deno.exit(1);
  }

  const data: Record<string, unknown> = JSON.parse(dataRaw);
  const schema = loadBacklogSchema();

  try {
    const backlogContent = await Deno.readTextFile(BACKLOG_PATH);
    const archiveContent = await Deno.readTextFile(ARCHIVE_PATH);

    const { block, regex } = extractPbiBlock(backlogContent, data.id as string, schema);
    const archiveCard = buildArchiveCard(data, block, schema);
    const { newBacklog, newArchive } = updateContents(
      backlogContent,
      archiveContent,
      regex,
      archiveCard,
    );

    console.log("--- PREVIEW: BACKLOG CHANGES ---");
    console.log(`PBI [${data.id}] will be removed.`);
    console.log("\n--- PREVIEW: ARCHIVE CHANGES ---");
    console.log(archiveCard);

    await Deno.writeTextFile(BACKLOG_PATH, newBacklog);
    await Deno.writeTextFile(ARCHIVE_PATH, newArchive);

    console.log("\nSuccessfully archived PBI.");
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${String(err)}`);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
