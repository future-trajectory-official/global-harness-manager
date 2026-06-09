# Configuration: Publish Targets for Skills

ワークスペース内のスキルをグローバルディレクトリに同期するための `config/publish-targets.md`
の記述形式です。

## 1. 記述フォーマット (Markdown 階層形式)

本ファイルは H2/H3 の Markdown 階層で管理されます。スクリプトは H2 タグをバンドル名、H3
タグをスキル名として解釈し、`bundles/[バンドル名]/[スキル名]` という相対パスを組み立てて同期します。

```markdown
## meta-bundle

### reconfirm-context

**説明**: ...

## system-bundle

### stateless-reset

**説明**: ...
```

- **無効化**: 対象スキルの `###` を削除することで、そのスキルは同期対象から外れます。

## 2. 初回セットアップ

`config/publish-targets.md` はソース管理対象**外**（`.gitignore`）のローカル設定ファイルです。

新しい環境にオンボーディングする際は、ソース管理された **`config/publish-targets.md.example`**
が正式なテンプレートとなります。以下の手順でセットアップしてください。

```bash
cp config/publish-targets.md.example config/publish-targets.md
```

## 3. 実行の仕組み

スクリプトは Markdown をパースし、H2 と H3 のネスト構造から `bundles/[H2]/[H3]`
というソースパスを動的に組み立ててコピー処理を実行します。

## 4. 注意事項

- バンドル名・スキル名は `.agents/skills/bundles/` に実在するディレクトリ名と一致させてください。
- 説明文などの H3 以外の行はスクリプトによって無視されるため、自由に記述可能です。
