# board-spec

ボード仕様の参照。

## 正の定義

- ボード識別子: `.opencode/core/gateway/field-registry.ts` の `BOARDS` （`productBacklog` /
  `sprintBoard` / `retrospectiveBoard` の3キー固定）。
- 作成スクリプト: `./scripts/create-boards.ts`
  （存在チェック→作成→再利用。既存の削除・改名は行わない）。

## 運用

- 所有者（Organization または個人アカウント）ごとに番号は異なる。
- 確定した番号は `generate-harnessrc.ts` の `--boards-json` に渡す。
