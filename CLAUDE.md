# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリの性質

**設計ドキュメントに加えて、P0-a（capture→digest 最短ループ）の最初の実装スライスが入った pnpm + TypeScript のモノレポ。** `packages/contracts`（`CapturedItem` 等の zod スキーマ）と `packages/cli`（`ws capture` コマンド）が実コードとして存在し、`templates/claude/`（Claude Code 用の `/capture` `/digest` コマンドと digest skill のテンプレート）も含まれる。

そのため:

- **`pnpm test`（Vitest）と `pnpm run typecheck`（`tsc -b packages/contracts packages/cli`）は実際に動くコマンド。** 「テストを流す」「型チェックを通す」といった依頼が来たら、まずこれらを実行する
- `templates/claude/` 配下は**テンプレートであり、`~/.claude/` へはまだデプロイされていない**（実配置は P0-b 以降）。ユーザーの Claude Code 環境の `/capture` `/digest` はこのテンプレートを直接使っているわけではないので、「実装が存在する」と「ユーザー環境で使える」を混同しないこと
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

一方、`capture/`・`publish/` に相当するもの（`packages/cli` の `ws capture` コマンド）と、`.claude/skills/`・`.github/workflows/` の一部に相当するもの（`templates/claude/commands/*.md`、`templates/claude/skills/digest/SKILL.md`）は、**この `work-stream` リポジトリの中にはテンプレート／実装として存在する**。ただし後者はあくまでテンプレートであり、`~/.claude/` へ配置されるまでは実際の Claude Code セッションからは呼び出せない。「`work-stream` 内にテンプレートがある」ことと「`knowledge-repo` の `inbox/`・`notes/` 構造が実在する」ことを混同しないこと。

フェーズ計画上、P0-a（repo 骨格 + `CapturedItem` スキーマ + `ws capture` + digest skill テンプレート整備）は本ブランチで実装済み。次に来るのは P0-b（runtime-git ポート・イベントログ・ownership-guard 等、`docs/superpowers/plans/2026-07-28-p0a-capture-digest-loop.md` 参照）。

## 執筆時の約束事

- **文書は日本語で書く**（README・両文書・コミットメッセージ本文すべて日本語。英語へ切り替えない）
- 指摘には重大度を付ける（既存文書は `【重大】` / `【中】` / `【軽微】` を見出しに付けている）
- 設計判断は結論だけでなく**却下した選択肢とその理由**を残す（既存文書はこの形式で書かれており、後から前提が変わったときに再評価できるようになっている）
- 事実主張には時点を明記する（「2026-07 時点」など）。上記のとおり外部事情の変化が設計を直接ひっくり返すため
