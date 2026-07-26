# 知識集積・アウトプット自動化基盤 — 0ベース設計案（対案）

作成日: 2026-07-10
位置づけ: Draft Proposal とは独立に、同じ要求（定額運用 / Claude Code・Codex 前提 / 人間承認 / 将来のマルチ基盤・製品化 / チャット履歴取り込みの手戻り回避）を満たすようゼロから設計した対案。

---

## 設計思想（Proposal との根本的な違いは 3 つ）

### 1. 「Obsidian をナレッジ基盤にする」のではなく「Git リポジトリの Markdown を正とし、Obsidian は View の一つ」とする

Proposal は Obsidian vault をストレージとして KnowledgeBaseAdapter で抽象化する構成だが、この設計では **プレーン Markdown + frontmatter の Git リポジトリ（knowledge repo）を唯一の正（SoT）** とし、Obsidian・Notion・Web UI はすべて「そのリポジトリを読み書きするクライアント」に格下げする。

- パイプライン（整形・ドラフト生成・配信）は**常に正規フォーマットだけを相手にする**。基盤ごとの分岐がコアから消える
- 将来の Notion 対応は「NotionAdapter を全パイプラインが経由する」のではなく「Notion ⇄ repo の**同期アダプタ**を端に足す」だけ。コアは無変更
- Repository パターンで異種ストアを抽象化すると、機能が全バックエンドの最小公倍数に縛られる（Notion にできないことはコアでも使えなくなる）。正規ストア + 端の同期なら、コアは常にフルパワーで書ける

### 2. ランタイムは GitHub をそのまま使う（Actions + PR + Mobile アプリ）。常時起動マシンは不要

`claude setup-token`（Pro/Max）で発行した OAuth トークンを `CLAUDE_CODE_OAUTH_TOKEN` として GitHub Actions に置けば、**サブスク定額のまま headless で Claude Code が動く**。よって:

- **オーケストレーション** = Actions の cron + push/merge トリガ。自前 cron・自宅サーバ・VPS は不要
- **承認** = Pull Request。ドラフト 1 本 = PR 1 本。GitHub Mobile から外出先でレビュー・修正・マージできる。frontmatter を手で書き換える承認フローより堅く、履歴・差し戻し・diff が全部ついてくる
- **配信** = 承認（merge）を path フィルタ付き workflow が拾って実行
- ローカルマシンは「あれば速い」オプション（対話的な編集セッション、Playwright 系）であって前提ではない

### 3. MVP に RAG インフラを作らない。「よくリンクされた Markdown + agentic search」で始める

Claude Code / Codex は Grep・Glob でリポジトリを探索するのが本業。ノートが atomic + backlink + MOC で整理されていれば、**エージェントの知識源としてはリポジトリを開くだけで機能する**。埋め込みインデックスや vector DB は、agentic search で足りなくなってから（ノート数千件〜）足す。他エージェントへの提供は「repo を検索する薄い MCP サーバ」を後付けすればよい。

---

## リポジトリ構成（= システム構成）

```
knowledge-repo/  (private)
├── inbox/                # L0: 未処理キャプチャ。CapturedItem 形式の .md
├── notes/                # L1: atomic notes（整形済・リンク済）
├── moc/                  # Maps of Content（テーマ別ハブ）
├── drafts/               # L2: チャネル別ドラフト（PR でレビューされる）
│   ├── x/
│   └── zenn/
├── articles/             # L4: Zenn 公開ディレクトリ（Zenn GitHub連携が直接見る）
├── published/            # 公開記録（URL・日時・metrics を frontmatter に蓄積）
├── capture/              # キャプチャ用 CLI（TypeScript）
│   ├── claude-code.ts    #   ~/.claude/projects/*.jsonl → inbox/
│   ├── chatgpt-export.ts #   エクスポート ZIP → inbox/
│   └── claude-export.ts
├── publish/              # 配信アダプタ CLI（TypeScript）
│   └── x.ts              #   スレッド投稿 → published/ に URL 記録
├── .claude/skills/       # digest / scout / draft（Codex 用に AGENTS.md も同内容を参照）
└── .github/workflows/
    ├── digest.yml        # cron 夜間: inbox → notes/moc（Claude Code headless）
    ├── scout.yml         # cron 週次: ネタ検出 → drafts/ を PR として起票
    └── publish.yml       # drafts→published の merge を拾って配信
```

**ディレクトリがそのままステータス機械**になる: `inbox/`（captured）→ `notes/`（processed）→ `drafts/` + open PR（needs-review）→ merge（approved）→ `published/`（published）。状態遷移 = git の移動とマージなので、監査ログが自動でつく。

### CapturedItem（正規化スキーマ、Zod で定義）

```yaml
---
sourceType: claude-code | chatgpt | claude-chat | manual | voice
sourceId:   "<conversationId>#<messageId>"   # 冪等キー。再取込の dedup に使う
capturedAt: 2026-07-10T09:00:00+09:00
originalTimestamp: ...
tags: []
---
（Markdown 正規化済み本文。会話は role 見出しで保持）
```

チャット履歴の取り込みは **pull 型（エクスポートファイル取込）を一級市民**とする。ChatGPT / Claude chat に会話取得の公式 API は無いため、エクスポート ZIP を `capture/*.ts` に食わせて inbox に落とすのが現実解。Claude Code だけはローカルログから自動で拾える。`sourceId` による dedup を最初から入れることで「同じ会話を何度エクスポートしても安全」にし、将来 MCP/API が生えたら同じ CapturedItem に流すだけにする — ここが手戻り回避の本体。

---

## シーケンス

```
[日中]   手動メモ / Claude Code ログ / (随時) ChatGPT エクスポート
            → capture CLI → inbox/ に commit・push

[夜間]   digest.yml (cron) → Claude Code headless (setup-token, 定額)
            inbox/ を読んで atomic note 化・リンク付与・MOC 更新
            → notes/ に commit（機械的整形なので direct push で可）

[週次]   scout.yml (cron) → 発信に足る塊を検出
            → チャネル別ドラフト生成 → drafts/ を **PR として起票**
            → GitHub 通知（= レビュー依頼）

[承認]   人間が GitHub (Mobile 可) で PR をレビュー・加筆・マージ

[配信]   publish.yml (merge トリガ, path フィルタ)
            drafts/zenn/ → articles/ へ移動 = Zenn が自動公開（連携済みなら push だけ）
            drafts/x/    → publish/x.ts が投稿（pay-per-use, リンク付 $0.20/件）
            → published/ に URL・日時を記録して commit

[週次]   (P3〜) metrics 取得 → published/ frontmatter へ → scout の入力に還元
```

## コンポーネント選定

| レイヤ | 選定 | 理由 / コスト |
|---|---|---|
| SoT | private GitHub repo（Markdown + frontmatter） | 無料。バージョン管理・PR・Mobile が全部ついてくる |
| 編集/閲覧 | Obsidian（obsidian-git / Working Copy で同期） | 無料。あくまで View。Notion 派には将来 sync アダプタ |
| LLM 実行 | Claude Code headless on GitHub Actions（`CLAUDE_CODE_OAUTH_TOKEN`） | Max サブスク定額。Actions 無料枠 2,000 分/月で夜間 10 分 × 30 日は余裕 |
| Codex 併用 | 同一 repo + AGENTS.md（skills と同内容を参照） | ChatGPT サブスク定額 |
| 承認 | GitHub PR | 無料。モバイル承認・履歴・差し戻し |
| Zenn | 同一 repo の `articles/` を Zenn GitHub 連携に接続 | 無料。「配信アダプタ」すら不要になる |
| X | API pay-per-use（$0.015/post、リンク付 $0.20） | 従量だが月数ドル。LLM 従量回避という本来の趣旨とは別枠として許容 |
| dev.to / Qiita | REST API アダプタ（P3 以降） | 無料 API |
| Note / YouTube | 「整形済みドラフトを人間が貼る」半自動（自動化しない） | Playwright 自動化は規約・破損リスクに見合わない |
| RAG | なし（agentic search）。P4 で必要なら埋め込み index + 検索 MCP | 定額内 |

## フェーズ計画

| Phase | 内容 | 完了条件 |
|---|---|---|
| P0（半日） | repo 骨格 + CapturedItem スキーマ + Obsidian で開く。digest skill を手元で実行 | 手動メモが夜間に notes 化される |
| P1 | setup-token を Secrets に登録し digest.yml を cron 化。claude-code ログ capturer | 無人で蓄積ループが回る |
| P2 | scout + draft → PR 起票。Zenn 連携（articles/）。X アダプタ | 承認 → 自動公開が 1 本通る |
| P3 | ChatGPT / Claude chat エクスポート importer。dev.to。metrics 還元 | チャット履歴が知識源に入る |
| P4 | 製品化スパイク: template repo + セットアップ CLI として配布可能に。Notion sync アダプタ or hosted Web UI の選定 | 他人が 30 分で自分の基盤を立てられる |

**製品化の形が Proposal と変わる点**: この設計の「製品」は SaaS ではなく、まず **template repo + CLI（フレームワーク型の配布）**。ユーザーは自分の GitHub + 自分の Claude サブスクで動かすので、運営側に LLM 原価が発生しない（サブスクの又貸しは規約上不可能なので、SaaS 型にするなら API 従量 + 課金転嫁が必須になる。それは P4 の後で判断）。

## この設計のリスク・割り切り

- **Actions cron のレイテンシ/揺れ**: 夜間バッチ用途なので許容。即時性が要る処理はない
- **Max の使用量上限**（5h ローリング + 週次）: 夜間バッチが対話利用と枠を食い合う。digest は差分処理にして消費を平準化する
- **setup-token は 1 年で失効**・個人アカウント紐付け。ローテーション手順を README に書いておく
- **Notion 双方向同期は難しい**ので P4 まで意図的に持たない。製品化時も「Notion 同期」より「repo の上に薄い Web UI」の方が筋が良い可能性が高く、そこで判断する
- **プライバシー**: チャット履歴には秘密が混ざる。inbox → notes の digest 時に「公開不可情報のマーキング」を skill の責務に入れ、drafts へは notes からしか作らせない
