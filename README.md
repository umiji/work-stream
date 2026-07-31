# work-stream

個人の学び・気づきをナレッジ基盤に集積し、複数メディアへの自動アウトプットを行うための基盤の設計ドキュメント。

- [`docs/system-design.md`](docs/system-design.md) — **現行の設計の正**。ゴール・要件ID・レイヤー構成・実装アイテムまで具体化したシステム設計書
- [`docs/zero-base-design.md`](docs/zero-base-design.md) — 上記の土台となった0ベース設計案（Git リポジトリを正とし、GitHub Actions + PR承認で回す構成）
- [`docs/architecture-review.md`](docs/architecture-review.md) — 初期 Draft Proposal（Obsidian/Notion比較・実行環境比較・アダプタ構成）へのレビュー

`umiji/concept-forge` の `claude/knowledge-base-architecture-rpuv66` ブランチで検討していた内容を、無関係なプロダクト（concept-forge = 発想醸成支援ツール）から切り離すため、このリポジトリに移設した。

## 導入

Claude Code に本リポジトリをプラグインとして追加する。

```
/plugin marketplace add umiji/work-stream
/plugin install work-stream@work-stream
```

インストール後に Claude Code を再起動すると、`/capture` `/digest` コマンドと `ws` コマンドがすべてのプロジェクトで使えるようになる想定である（この動作は 2026-07-31 時点で実機検証されていない）。

保存先（knowledge-repo）は次の順で解決される。

1. 環境変数 `WORK_STREAM_KNOWLEDGE_REPO`
2. カレントディレクトリから親方向へ辿って見つかる `.work-stream.json` のあるディレクトリ
3. `~/.config/work-stream/config.json` の `knowledgeRepo`

knowledge-repo 以外のプロジェクトから使う場合は 3 を設定する。

## 開発

```
pnpm install
pnpm test          # vitest
pnpm run typecheck # tsc -b
pnpm run build     # dist/ws.mjs を再生成する
```

**`packages/cli/src/` または `packages/contracts/src/` を変更したら、必ず `pnpm run build` を実行して `dist/ws.mjs` も一緒にコミットすること。** プラグインは配布時にビルドされないため、この生成物が配布の実体になる。
