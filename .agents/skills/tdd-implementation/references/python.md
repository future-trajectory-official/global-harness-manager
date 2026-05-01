# Python TDD リファレンス

Python 環境で TDD を実行する際の具体的なコマンドとベストプラクティスです。

## 推奨コマンド

### 1. テスト実行 (RED/GREEN確認)
```bash
pytest
```

### 2. 品質検証 (DoD)
```bash
# 静的解析・フォーマッタ
ruff check .
ruff format --check
```

## 実装のポイント

- **テストコードの配置**: `tests/` ディレクトリ配下、または実装ファイルと同じディレクトリに `test_*.py` として配置します。
- **テスティングフレームワーク**: `pytest` を推奨します。
- **モック**: `unittest.mock` を活用してください。
