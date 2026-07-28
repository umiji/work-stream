# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの性質

**現時点ではコードが 1 行も無い、設計ドキュメント専用リポジトリ**（追跡ファイルは `README.md` と `docs/` 配下の 2 文書のみ）。

そのため:

- **ビルド / テスト / lint コマンドは存在しない。** `package.json`・`tsconfig.json`・CI 設定を探しても無い。「テストを流す」「ビルドを通す」といった依頼を受けたら、まず実装がまだ無いことを伝える
- 検証手段は文書レビューのみ。変更の妥当性は「2 文書間の整合が取れているか」「前提事実が古くなっていないか」で判断する
- 最初に実装が入る場合、設計上は TypeScript の CLI（`capture/`・`publish/`）と GitHub Actions workflow がその対象になる（下記「まだ存在しないもの」参照）

## このプロジェクトが設計しているもの

個人の学び・気づきをナレッジ基盤に集積し、複数メディア（Zenn / X / dev.to 等）へ自動アウトプットする基盤。**設計そのものが成果物**であり、実装は未着手。

## 2 つの文書の関係（ここを取り違えると議論が噛み合わない）

| 文書 | 位置づけ |
|---|---|
| [docs/system-design.md](docs/system-design.md) | **現行の設計の正**。ゴール・要件ID・レイヤー構成・実装アイテム（IMPL-Lx-xx）まで具体化済み。**設計上の質問はまずここを見る** |
| [docs/zero-base-design.md](docs/zero-base-design.md) | system-design の土台となった 0 ベース対案。判断の履歴として保存 |
| [docs/architecture-review.md](docs/architecture-review.md) | **他所にある Draft Proposal への批評**。Proposal 本体はこのリポジトリに無い |

重要な注意点:

- **レビュー対象の Draft Proposal はこのリポジトリに存在しない。** 元は `umiji/concept-forge` の `claude/knowledge-base-architecture-rpuv66` ブランチで検討されていたもので、無関係なプロダクト（concept-forge = 発想醸成支援ツール）から切り離すためにレビューと対案だけがここへ移設された。review 文書が「Draft では〜」と参照している内容は、review 文書内の引用からしか辿れない
- 両文書は同じ結論を書いているわけではない。review は Proposal の枠組み（Obsidian を基盤とし `KnowledgeBaseAdapter` で抽象化）を前提に修正を求めるのに対し、zero-base はその枠組み自体を捨てている。**両者が食い違って見えるのは想定どおり**であり、片方に合わせて他方を「修正」しないこと

## 設計の根幹（複数文書を横断しないと見えない判断）

zero-base design が Proposal と決別した 3 点。ここが以降の全判断の土台になる。

1. **SoT は Git リポジトリのプレーン Markdown + frontmatter。** Obsidian / Notion は「そのリポジトリを読み書きする View」に格下げ。ストレージを Repository パターンで抽象化すると機能が全バックエンドの最小公倍数に縛られる（Notion にできないことがコアでも使えなくなる）ため、正規ストア + 端に同期アダプタ、という形を取る
2. **常時起動マシンは不要。GitHub をそのままランタイムにする。** `claude setup-token` で発行した OAuth トークンを `CLAUDE_CODE_OAUTH_TOKEN` として Actions に置けば、サブスク定額のまま headless で Claude Code が動く。オーケストレーション = Actions の cron、**承認 = Pull Request のマージ**（GitHub Mobile で外出先から承認できる）、配信 = merge を path フィルタ付き workflow が拾う
3. **MVP に RAG インフラを作らない。** atomic note + backlink + MOC で整理された Markdown を、エージェントが Grep / Glob で探索する（agentic search）。埋め込み index はノート数千件規模で足りなくなってから

派生する重要な帰結:

- **ディレクトリ構造がそのままステータス機械**（`inbox/` = captured → `notes/` = processed → `drafts/` + open PR = needs-review → merge = approved → `published/`）。状態遷移が git の移動とマージなので監査ログが自動でつく。ステータスを frontmatter のフィールドとして再発明しないこと
- **`CapturedItem` の正規化スキーマと冪等キー `sourceId` を先に確定させることが、手戻り回避の本体。** ChatGPT / Claude chat には会話取得の公式 API が無く、エクスポート ZIP の取込（pull 型）が現実解。将来 MCP / API が生えても同じ `CapturedItem` に流すだけにする、というのが設計意図
- **「定額」の趣旨は LLM のエージェント従量課金の回避**であり、配信 API の微少な従量（X の投稿課金など）は別枠として許容する、と整理されている。この線引きを崩さないこと

## 前提事実と鮮度（両文書とも 2026-07-10 時点）

設計の結論が、以下の**時点依存の外部事実に強く依存している**。関連する議論を再開するときは、まず現在も成立するか確認すること。

- `claude setup-token` により headless / CI でサブスク定額利用が公式サポートされている（この 1 点が「常時起動マシン不要」の全根拠）
- Max プランには 5 時間ローリング + 週次の使用量上限があり、夜間バッチが対話利用と枠を食い合う
- `setup-token` は 1 年で失効し、個人アカウント紐付けで共有不可。**製品化時にユーザーのサブスクへ乗ることは不可能**（SaaS 化するなら API 従量 + 課金転嫁が前提）
- X API は 2026-02 に無料枠廃止・pay-per-use へ移行。投稿 $0.015/件、**リンク付き投稿は $0.20/件**

## まだ存在しないもの（実在すると誤認しないこと）

zero-base design の「リポジトリ構成」章にある `inbox/`・`notes/`・`moc/`・`drafts/`・`articles/`・`published/`・`capture/`・`publish/`・`.claude/skills/`・`.github/workflows/` は**すべて設計案であって未作成**。文書は `knowledge-repo/` という名前で書かれているが、実在するのはこの `work-stream` リポジトリだけ。両者が同一リポジトリになるのか分離するのかも未決。

フェーズ計画上、次に来るのは P0（repo 骨格 + `CapturedItem` スキーマ + digest skill を手元で実行）。

## 執筆時の約束事

- **文書は日本語で書く**（README・両文書・コミットメッセージ本文すべて日本語。英語へ切り替えない）
- 指摘には重大度を付ける（既存文書は `【重大】` / `【中】` / `【軽微】` を見出しに付けている）
- 設計判断は結論だけでなく**却下した選択肢とその理由**を残す（既存文書はこの形式で書かれており、後から前提が変わったときに再評価できるようになっている）
- 事実主張には時点を明記する（「2026-07 時点」など）。上記のとおり外部事情の変化が設計を直接ひっくり返すため
