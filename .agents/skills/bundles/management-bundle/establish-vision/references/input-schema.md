# Input Schema & Output Format

## 入力 JSON スキーマ

```typescript
interface EstablishVisionInput {
  title: string; // ビジョンの短い名前。GitHub Issue のタイトルになる。
  scope: { // GitHub 上の owner/repository。
    owner: string;
    repository: string;
  };
  targetAudience: string; // 誰のためのプロダクトか。具体的なペルソナを含める。
  value: string; // ユーザーが得られる体験を具体的な動詞で記述。
  differentiator: string; // 競合や代替手段では満たせない独自の価値。
  outcomes: { // プロダクトが普及したときの変化。
    title: string;
    description: string;
  }[];
}
```

## 実行される操作

`establish_vision.ts` は以下の 3 つの Step を順次実行します：

| Step | operation     | 説明                                                                              |
| ---- | ------------- | --------------------------------------------------------------------------------- |
| 1    | `searchItems` | 既存の Vision Issue の有無を確認                                                  |
| 2    | `createItem`  | `type:Vision` ラベル付きで GitHub Issue を作成。Body には変更履歴テーブルを記載。 |
| 3    | `addComment`  | バージョン管理されたビジョン本文（Statement + Outcomes）をコメントとして追加      |

## 出力形式

成功時には `ExecutionResult` が JSON で標準出力に出力されます。

```typescript
interface ExecutionResult {
  stepResults: {
    operation: string; // 実行された操作名
    success: boolean; // 成功/失敗
    itemId?: string; // 作成された Issue の番号（createItem 時）
    nodeId?: string; // GraphQL Node ID
    output?: unknown; // 操作固有の出力
    error?: string; // エラーメッセージ（失敗時）
  }[];
}
```

失敗時はエラーメッセージが標準エラー出力に出力され、プロセスは終了コード 1 で終了します。
