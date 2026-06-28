# ビジョン要素の深掘り質問集

## 対象ユーザー

- 一番最初にこのプロダクトを使って熱狂してくれる人は、どんな人か？
- その人は今どんな課題を抱えているのか？
- ユーザーを「全員」とするとメッセージが拡散する。優先順位はどうか？

## 提供価値

- ユーザーはこのプロダクトで「何ができるようになる」のか？
- 「So That」連鎖: それができると、その結果どうなる？ → さらにその先は？
- 競合や代替手段（Excelや手作業等）と比べて何が決定的に違うのか？

## 差別化要因

- 既存の代替手段をユーザーが使わない理由は何か？
- このプロダクトにしかできない唯一無二の要素は何か？

## アウトカム

- このプロダクトが普及した世界で、ユーザーの1日の流れはどう変わるか？
- 3年後、このプロダクトが当たり前になった世界を想像してください — どんな変化が起きていますか？

# 入力 JSON の組み立て

収集した情報を以下の形式にマッピングする。scope（owner/repository）と title
はスクリプトが自動解決するため入力不要。

```json
{
  "targetAudience": "<対象ユーザー>",
  "value": "<提供価値>",
  "differentiator": "<差別化要因>",
  "outcomes": [
    { "title": "<アウトカム名>", "description": "<説明>" }
  ]
}
```

# 実行

```bash
# dry-run（事前確認） — ユーザーに内容を提示し承認を得る
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/establish-vision/scripts/establish_vision.ts --dry-run

# 本実行（ユーザー承認後）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/establish-vision/scripts/establish_vision.ts
```
