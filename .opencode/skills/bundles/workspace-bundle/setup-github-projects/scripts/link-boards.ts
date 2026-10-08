/**
 * ボードのリポジトリリンク機能。
 *
 * `create-boards.ts` が作成・再利用したボード（`HarnessRcBoards`）を、対象リポジトリに
 * リンクする。リンクは Project とリポジトリの紐づけのみを行い、issue はボードへ追加しない。
 * リンク済みのボードは再リンクせず skip する（冪等）。既存ボードの削除・改名は行わない。
 *
 * gh 呼出は `LinkGhRunner` に分離し、テスト時はモックを注入する。
 */

import type { HarnessRcBoards } from "../../../../../core/gateway/field-registry.ts";
import { runGh } from "./subprocess.ts";

/** gh 呼出の注入点（テスト用に差し替え可能）。 */
export interface LinkGhRunner {
  /** リポジトリに既にリンクされているプロジェクト番号一覧を取得する。 */
  readonly listLinked: (repo: string) => Promise<readonly number[]>;
  /** プロジェクトをリポジトリにリンクする。 */
  readonly link: (owner: string, projectNumber: number, repo: string) => Promise<void>;
}

/**
 * `gh api graphql` で `repository.projectsV2` を取得した生出力を解析する（純関数）。
 *
 * 形式: `{"data":{"repository":{"projectsV2":{"nodes":[{"number":N}]}}}}`
 * 不正JSON・想定外の形式は `Error` を投げる。
 *
 * @param raw `gh api graphql` の標準出力
 * @returns リンク済みプロジェクト番号一覧
 */
export function parseLinkedProjectsJson(raw: string): number[] {
  let parsed: {
    data?: { repository?: { projectsV2?: { nodes?: Array<{ number?: unknown }> } } };
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("linked projects の JSON 形式が不正です");
  }
  const nodes = parsed.data?.repository?.projectsV2?.nodes;
  if (!Array.isArray(nodes)) {
    throw new Error("linked projects の結果に projectsV2.nodes がありません");
  }
  return nodes.flatMap((node) => (typeof node.number === "number" ? [node.number] : []));
}

/** リンク計画（純関数 `planLinks` の戻り値）。 */
export interface LinkPlan {
  /** 今回リンクする番号（順序は boards の定義順）。 */
  readonly toLink: number[];
  /** リンク済みのためスキップする番号。 */
  readonly skip: number[];
}

/**
 * ボード番号とリンク済み一覧から、リンク計画を組み立てる（純関数）。
 *
 * 番号0（未確定）は対象外とする。同一番号の重複は1件に集約する。
 *
 * @param boards 対象ボード番号（`HarnessRcBoards`）
 * @param linked リンク済みプロジェクト番号一覧
 * @returns リンク計画
 */
export function planLinks(boards: HarnessRcBoards, linked: readonly number[]): LinkPlan {
  const linkedSet = new Set(linked);
  const toLink: number[] = [];
  const skip: number[] = [];
  for (const number of [boards.productBacklog, boards.sprintBoard, boards.retrospectiveBoard]) {
    if (number <= 0 || toLink.includes(number) || skip.includes(number)) continue;
    if (linkedSet.has(number)) skip.push(number);
    else toLink.push(number);
  }
  return { toLink, skip };
}

/**
 * ボードを対象リポジトリにリンクする（冪等）。
 *
 * @param owner ボード所有者
 * @param repo 対象リポジトリ（`owner/repo`）
 * @param boards 対象ボード番号
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @returns 実行したリンク番号とスキップ番号
 */
export async function linkBoards(
  owner: string,
  repo: string,
  boards: HarnessRcBoards,
  runner: LinkGhRunner = defaultLinkGhRunner,
): Promise<LinkPlan> {
  const linked = await runner.listLinked(repo);
  const plan = planLinks(boards, linked);
  for (const number of plan.toLink) {
    await runner.link(owner, number, repo);
  }
  return plan;
}

/**
 * `--dry-run` 用の計画表示行を組み立てる（純関数）。
 *
 * @param repo 対象リポジトリ
 * @param plan リンク計画
 * @returns 表示行
 */
export function formatLinkPlan(repo: string, plan: LinkPlan): string[] {
  return [
    ...plan.toLink.map((number) => `link project #${number} -> ${repo}`),
    ...plan.skip.map((number) => `skip project #${number} (already linked to ${repo})`),
  ];
}

/** 既定の gh 呼出実装（実 gh を使用）。 */
export const defaultLinkGhRunner: LinkGhRunner = {
  listLinked: async (repo) => {
    const [owner, name] = repo.split("/");
    const query =
      `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){projectsV2(first:100){nodes{number}}}}`;
    const result = await runGh([
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
    ]);
    if (result.code !== 0) {
      throw new Error(`linked projects の取得に失敗しました: ${result.stderr.trim()}`);
    }
    return parseLinkedProjectsJson(result.stdout);
  },
  link: async (owner, projectNumber, repo) => {
    const result = await runGh([
      "project",
      "link",
      String(projectNumber),
      "--owner",
      owner,
      "--repo",
      repo,
    ]);
    if (result.code !== 0) {
      throw new Error(`project #${projectNumber} のリンクに失敗しました: ${result.stderr.trim()}`);
    }
  },
};

if (import.meta.main) {
  const args = Deno.args;
  const repoIndex = args.indexOf("--repo");
  const boardsIndex = args.indexOf("--boards-json");
  const repo = repoIndex >= 0 ? args[repoIndex + 1] : undefined;
  const boardsJson = boardsIndex >= 0 ? args[boardsIndex + 1] : undefined;
  const dryRun = args.includes("--dry-run");
  if (!repo || !repo.includes("/") || !boardsJson) {
    console.error("利用法: link-boards.ts --repo <owner/repo> --boards-json '<json>' [--dry-run]");
    Deno.exit(1);
  }
  const owner = repo.split("/")[0];
  const boards = JSON.parse(boardsJson) as HarnessRcBoards;
  if (dryRun) {
    const linked = await defaultLinkGhRunner.listLinked(repo);
    console.log(formatLinkPlan(repo, planLinks(boards, linked)).join("\n"));
  } else {
    const plan = await linkBoards(owner, repo, boards);
    console.log(formatLinkPlan(repo, plan).join("\n"));
  }
}
