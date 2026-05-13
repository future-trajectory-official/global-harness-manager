# Automated Archive Logic

本ドキュメントは、`update-backlog` スキルにおけるアーカイブ自動化の技術詳細を定義します。エージェントは、PBI のアーカイブを実行する際に本情報を参照してください。

## 1. スクリプト仕様
アーカイブ処理は、以下の Deno スクリプトによって決定論的に実行されます。
- **パス**: `scripts/manage_backlog.ts`

### 入力データ構造 (JSON)
AI は以下の構造を持つ JSON を生成し、引数 `--data` として渡します。

```json
{
  "id": "[Epic/Feature]/PBI-Name",
  "insights": "得られた知見の本文。将来の AI が再利用しやすいよう具体的に記述する。",
  "tags": ["#Decision", "#Architecture", "#Troubleshooting", "#Pivot"],
  "metrics": { "turns": 15, "sessions": 1 },
  "outcomes": ["- 成果物1のリンク/パス", "- 成果物2の名称"]
}
```

## 2. 実行手順
エージェントは以下のコマンドを構成し、実行します。

```bash
deno run -A .agents/skills/bundles/management-bundle/update-backlog/scripts/manage_backlog.ts --data '[構成したJSON]'
```

## 3. 知見タグの選定基準
アーカイブガイドライン（`backlog-guidelines.md`）に基づき、以下の優先順位でタグを付与してください。

1. **`#Decision`**: 設計や優先順位の変更があった場合。
2. **`#Pivot`**: 当初の AC や方針から転換した場合。
3. **`#Troubleshooting`**: 技術的なハマり所を解決した場合。
4. **`#Architecture`**: ディレクトリ構造や依存関係に影響を与えた場合。
