# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **最優先ルール**: ユーザーへの回答は必ず日本語で、かつ「[会話での説明スタイル](#会話での説明スタイル)」に従うこと。これは技術的な正しさと同格で守るべき前提であり、調査結果の報告・バグ原因の説明・レビュー結果・進捗報告のすべてに適用される。回答を書き終えたら、送信前に同章のチェックリストを自己確認する。

## リポジトリの性質

**設計ドキュメントに加えて、P0-a（capture→digest 最短ループ）の最初の実装スライスが入った pnpm + TypeScript のモノレポ。** `packages/contracts`（`CapturedItem` 等の zod スキーマ）と `packages/cli`（`ws capture` コマンド）が実コードとして存在し、`commands/`・`skills/`（Claude Code プラグインとして配布される `/capture` `/digest` コマンドと digest skill）も含まれる。

そのため:

- **`pnpm test`（Vitest）と `pnpm run typecheck`（`tsc -b packages/contracts packages/cli`）は実際に動くコマンド。** 「テストを流す」「型チェックを通す」といった依頼が来たら、まずこれらを実行する
- `commands/`・`skills/` は **Claude Code プラグインとして配布される実体**であり、`/plugin install work-stream@work-stream` を実行済みの環境では実際に `/capture` `/digest` として呼び出せる（2026-07-31 時点）。`packages/cli/src/` を変更した場合は `pnpm run build` で `dist/ws.mjs` を再生成しないと、配布物側に反映されない点に注意する。この再生成漏れは `pnpm test` や `pnpm run typecheck` では検知できず、自動チェックが green のままプラグインだけが古い挙動を配布し続ける
- 検証手段は「テスト/型チェックの green」に加えて文書レビューも引き続き必要。設計側の変更は「複数文書間の整合が取れているか」「前提事実が古くなっていないか」で判断する
- まだ実装されていない範囲（`knowledge-repo` 側の `inbox/`・`notes/` 構造、GitHub Actions workflow 等）は下記「まだ存在しないもの」を参照

## このプロジェクトが設計しているもの

個人の学び・気づきをナレッジ基盤に集積し、複数メディア（Zenn / X / dev.to 等）へ自動アウトプットする基盤。**設計そのものが成果物**である段階から、P0-a で最初の実装（capture→ingest の最短ループ）に着手した段階に移っている。

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
- **`CapturedItem` の正規化スキーマと冪等キー `sourceId` を先に確定させることが、手戻り回避の本体。** ChatGPT / Claude chat には会話取得の公式 API が無く、エクスポート ZIP の取込（pull 型）が現実解。将来 MCP / API が生えても同じ `CapturedItem` に流すだけにする、というのが設計意図。（`packages/contracts` の `CapturedItemSchema` が P0-a でこのスキーマの最初の実装）
- **「定額」の趣旨は LLM のエージェント従量課金の回避**であり、配信 API の微少な従量（X の投稿課金など）は別枠として許容する、と整理されている。この線引きを崩さないこと

## 前提事実と鮮度（両文書とも 2026-07-10 時点）

設計の結論が、以下の**時点依存の外部事実に強く依存している**。関連する議論を再開するときは、まず現在も成立するか確認すること。

- `claude setup-token` により headless / CI でサブスク定額利用が公式サポートされている（この 1 点が「常時起動マシン不要」の全根拠）
- Max プランには 5 時間ローリング + 週次の使用量上限があり、夜間バッチが対話利用と枠を食い合う
- `setup-token` は 1 年で失効し、個人アカウント紐付けで共有不可。**製品化時にユーザーのサブスクへ乗ることは不可能**（SaaS 化するなら API 従量 + 課金転嫁が前提）
- X API は 2026-02 に無料枠廃止・pay-per-use へ移行。投稿 $0.015/件、**リンク付き投稿は $0.20/件**

## まだ存在しないもの（実在すると誤認しないこと）

zero-base design の「リポジトリ構成」章にある `inbox/`・`notes/`・`moc/`・`drafts/`・`articles/`・`published/` を実際に持つ **`knowledge-repo` リポジトリはまだ存在しない**。ローカルにスクラッチとして置かれることはあっても、この `work-stream` リポジトリの git 管理下には無い、別の・未バージョン管理のディレクトリである（両者が同一リポジトリになるのか分離するのかも未決）。

一方、`capture/`・`publish/` に相当するもの（`packages/cli` の `ws capture` コマンド）と、`.claude/skills/` の一部に相当するもの（`commands/*.md`、`skills/digest/SKILL.md`）は、**この `work-stream` リポジトリの中に実装として存在し、プラグイン経由で実際に呼び出せる**。「`work-stream` 内に実装がある」ことと「`knowledge-repo` の `inbox/`・`notes/` 構造が実在する」ことは依然として別の話なので混同しないこと。

フェーズ計画上、P0-a（repo 骨格 + `CapturedItem` スキーマ + `ws capture` + digest skill テンプレート整備）は本ブランチで実装済み。次に来るのは P0-b（runtime-git ポート・イベントログ・ownership-guard 等、`docs/superpowers/plans/2026-07-28-p0a-capture-digest-loop.md` 参照）。

## 執筆時の約束事

- **文書は日本語で書く**（README・両文書・コミットメッセージ本文すべて日本語。英語へ切り替えない）
- 指摘には重大度を付ける（既存文書は `【重大】` / `【中】` / `【軽微】` を見出しに付けている）
- 設計判断は結論だけでなく**却下した選択肢とその理由**を残す（既存文書はこの形式で書かれており、後から前提が変わったときに再評価できるようになっている）
- 事実主張には時点を明記する（「2026-07 時点」など）。上記のとおり外部事情の変化が設計を直接ひっくり返すため

## 会話での説明スタイル

**このリポジトリで最も守られていないルールがここ。** 実装や調査に集中すると説明が「コードをなぞるだけ」に退化しやすいため、回答のたびに意識的に適用すること。ユーザーへの回答・説明は、コード内のシンボル名や変数名だけを羅列した技術的すぎる言い方を避け、**ユーザー（人間）の視点に立ったわかりやすい説明**を優先する。

### 適用範囲

会話での全発言に適用する。特に以下は例外なく対象:

- 調査・原因究明の結果報告
- コードレビューや指摘の説明
- 実装完了時の変更内容の説明
- テスト・型チェックの失敗内容の説明
- 設計判断の提案と、その理由の説明

「短い返答だから」「自明だから」は適用除外の理由にならない。

### 守ること

- **日本語で回答する**: 英語へ切り替えない（[執筆時の約束事](#執筆時の約束事)と同じ原則を会話にも適用する）
- **関数名や変数名の羅列で説明を済ませない**: 「`ensureGaConfigured` 内の `isDev` が `false` になる」のような説明だけでは、受け取る側が「それが何を指す機能なのか」を直感的に理解できない
- **機能や役割を主語にして説明する**: まず「何のための機能／処理なのか」「どのタイミングで動く処理なのか」を日本語の一般的な言葉で説明した上で、補足的に関数名・変数名を添える
  - 悪い例: 「`ensureGaConfigured` 内の `isDev` が `false` になるため…」
  - 良い例: 「GA4 の初期化を行う処理（`ensureGaConfigured` 関数）において、開発・プレビュー環境であることを識別するフラグ（`isDev` 変数）が `false`（本番環境判定）になってしまうため…」
- **根本原因と影響を明確にする**: コードの挙動をなぞるだけでなく、それが結果として「画面でどう見えるか」「動作にどう影響するか」を明確に示す
- **初出の専門用語・ロール名には都度説明を添える**: このプロジェクト固有の仕組みや役割（例: Bull / Bear、Adversary、Judge による査問、`CapturedItem`、冪等キー、agentic search など）は、そのセッションで初めて登場した時点で「それが何をする役割／概念なのか」を一言で補足する。過去のセッションで説明済みでも、新しいセッションでは初出として扱う

### 送信前チェックリスト

回答を書き終えたら、送信する前に次を自己確認する:

- [ ] 日本語で書かれているか
- [ ] シンボル名（関数名・変数名・ファイル名）が、日本語の説明なしで単独で登場していないか
- [ ] 「何が起きるか」だけでなく「その結果ユーザーにどう影響するか」まで書いてあるか
- [ ] このセッションで初めて使った専門用語・ロール名に説明を添えたか
