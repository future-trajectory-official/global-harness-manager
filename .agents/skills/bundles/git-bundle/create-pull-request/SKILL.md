---
name: create-pull-request
description: 作業完了後、GitHub CLI (gh) を用いてPull Requestを作成し、ユーザーへエビデンス付きで解説を行います。
tags:
  - trigger: create-pr, make-pull-request, submit-pr, open-pr
  - category: git
  - constraints: requires-gh-cli, requires-pushed-branch
---

# create-pull-request

GitHub CLI (`gh`) を活用してプルリクエストを作成し、レビューア（ユーザー）への説明と証拠の提示を行います。

## 手順

1. ブランチがリモートに push されていることを確認する。
2. `gh pr create` コマンドを用いて、現在の作業ブランチから `main` 宛（または適切なベース宛）のPRを作成する。
   - **⚠️ 必須要件**: エージェントのハングアップを防ぐため、必ず完全な非対話モード（例: `gh pr create --title "..." --body "..."`）で実行すること。
3. チャットにて、ユーザーに対して「実装の要点」と「テスト結果」を分かりやすく日本語で解説し、進行の承認（マージのGOサイン）を求める。
   - ※ユーザーがWeb上で直接コードを見なくても判断できるレベルの詳細な要約を提供すること。
4. **証拠画像のチャット表示**
   - 契機: 開発した機能の正しさが視覚的にしか確認できない場合（UI変更など）。
   - 指示: PRの解説時に、画像をともなう必要がある場合は、必ず実行結果の証拠画像（PNG/JPG等）をチャットウィンドウに直接表示（`![alt](absolute_path)` の形式で埋め込み）して解説すること。
   - 理由: gitignore されている一時ファイル等は GitHub 上では見られないため、このチャット画面での視覚的共有を最優先する。
