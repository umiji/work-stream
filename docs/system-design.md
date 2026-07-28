# 知識集積・アウトプット自動化基盤 — システム設計書

作成日: 2026-07-28
位置づけ: [zero-base-design.md](zero-base-design.md) の設計思想を継承し、実装可能な粒度まで具体化した**設計の正**。
前提文書: [architecture-review.md](architecture-review.md)（他所の Draft Proposal への批評）、[zero-base-design.md](zero-base-design.md)（0 ベース対案）

---

## 1. プロジェクトのゴール

### 1.1 解きたい課題

生成 AI との対話が日常の思考手段になった。検討もディスカッションも調べ物も雑談も AI を介して行っている。**しかしそこで生まれた考えや得た知識は、対話が終わった瞬間にどこにも残らず流れていく。**

結果として、同じことを何度も調べ直し、発信できるだけの素材が積み上がっているはずなのに、形になったものが何もない。

### 1.2 ゴール

> **生成 AI を介して行った検討・ディスカッション・調べ物・雑談など、あらゆるインプットを 1 か所に集約し、そこからいつでも記事・SNS・動画としてアウトプットできるシステムを作る。**

分解すると 3 つ。

| # | ゴール | 判定基準 |
|---|---|---|
| G-1 | **貯まる** | どの AI クライアントで生まれた内容も、意識的な整理作業なしに 1 か所へ入る |
| G-2 | **使える** | 貯めた知識が、後から自分にも AI にも検索・参照でき、増えても構造が破綻しない |
| G-3 | **出る** | 蓄積から発信ネタが立ち上がり、人間が承認するだけで各メディアへ公開される |

開発はこのシステムのユースケースの 1 つであって、前提ではない。

### 1.3 スコープの線引き

| 区分 | 内容 |
|---|---|
| **MVP でやる** | 取り込み（Claude Code / Gemini / 手動）、知識化、Zenn・X への発信 |
| **MVP でやらない が 後でやる** | **Note / YouTube への発信**（半自動 export として設計に含める）、過去分の一括取込、MCP、Notion ミラー |
| **やらない** | マルチテナント / 認証 / 課金、リアルタイム処理、RAG インフラ（ノート数千件までは agentic search で足りる）、Notion 双方向同期 |

---

## 2. 要件一覧と実装アイテムの紐づき

### 2.1 要件 ID の体系

| 接頭辞 | 分類 |
|---|---|
| `REQ-C-xx` | Capture（取り込み） |
| `REQ-K-xx` | Knowledge（知識の構造） |
| `REQ-U-xx` | User（利用者自身の情報） |
| `REQ-A-xx` | Agent（自動処理） |
| `REQ-P-xx` | Policy（統制・安全） |
| `REQ-D-xx` | Distribution（配信） |
| `REQ-I-xx` | Interface（対話・閲覧） |
| `REQ-N-xx` | Non-functional（非機能） |

### 2.2 トレーサビリティ早見表

| 要件 ID | 要件 | ゴール | 実装アイテム | Phase |
|---|---|---|---|---|
| **REQ-C-01** | **どの開発プロジェクトからでも**気づき・検討を登録できる | G-1 | `IMPL-L0-07` `IMPL-L1-03` | P0 |
| **REQ-C-02** | Gemini の会話を、要約させた上で自動で登録できる | G-1 | `IMPL-L1-04` `IMPL-L1-05` `IMPL-L1-01` | P1 |
| **REQ-C-03** | Claude チャットで得た知識を登録できる | G-1 | `IMPL-L1-03`（Claude Code 経由で代替） | P0 |
| **REQ-C-04** | 手動メモを登録できる | G-1 | `IMPL-L1-02` | P0 |
| **REQ-C-05** | 同じ内容を何度投入しても重複しない | G-1 | `IMPL-L1-01` | P0 |
| **REQ-C-06** | 過去の会話を一括で取り込める | G-1 | `IMPL-L1-06` | P3 |
| **REQ-C-07** | 任意のアプリからも登録経路がある | G-1 | `IMPL-L1-05` | P1 |
| **REQ-K-01** | 知識は 1 ノート 1 アイデアの atomic note として保存される | G-2 | `IMPL-L2-02` `IMPL-L3-01` | P0 |
| **REQ-K-02** | 自分発の考えと外部由来の知識を区別して保持する | G-2 | `IMPL-L0-01` `IMPL-L2-02` | P0 |
| **REQ-K-03** | ノート単体で意味が完結する（Git 履歴・PR に依存しない） | G-2 | `IMPL-L2-05` `IMPL-L0-03` | P0 |
| **REQ-K-04** | ノート間がリンクと MOC で辿れる | G-2 | `IMPL-L2-03` `IMPL-L2-04` | P0 |
| **REQ-K-05** | 元の会話まで追跡できる | G-2 | `IMPL-L0-01` | P0 |
| **REQ-K-06** | **ノートが増えても構造が破綻しない** | G-2 | `IMPL-L2-06` `IMPL-L2-04` | P0 |
| **REQ-K-07** | **同一話題は新規作成ではなく更新され、知識が育つ** | G-2 | `IMPL-L3-01` | P0 |
| **REQ-K-08** | **重複・矛盾ノートが検出され統合できる** | G-2 | `IMPL-L3-01` | P2 |
| **REQ-U-01** | **自分が何者かをシステムが参照できる** | G-3 | `IMPL-L2-07` | P0 |
| **REQ-U-02** | **自分の文体でドラフトが書かれる** | G-3 | `IMPL-L2-07` `IMPL-L3-03` | P2 |
| **REQ-U-03** | **自分固有の公開不可領域が守られる** | G-3 | `IMPL-L2-07` `IMPL-L4-03` | P2 |
| **REQ-A-01** | inbox → notes 化を実行できる | G-2 | `IMPL-L3-01` `IMPL-L3-04` | P0 |
| **REQ-A-02** | 発信に足るネタが検出される | G-3 | `IMPL-L3-02` | P2 |
| **REQ-A-03** | チャネル別のドラフトが生成される | G-3 | `IMPL-L3-03` | P2 |
| **REQ-P-01** | 公開前に必ず人間の承認を経る | G-3 | `IMPL-L4-04` | P2 |
| **REQ-P-02** | 一般的な秘匿情報の公開をブロックする | G-3 | `IMPL-L4-01` | P2 |
| **REQ-P-03** | 外部由来コンテンツの verbatim 公開をブロックする | G-3 | `IMPL-L4-02` | P2 |
| **REQ-P-04** | **private データが public リポジトリへ漏れない** | — | `IMPL-L0-09` | P1（L0-08 のワークフロー群に依存するため） |
| **REQ-D-01** | Zenn に公開できる | G-3 | `IMPL-L5-01` `IMPL-L5-02` | P2 |
| **REQ-D-02** | X に投稿できる | G-3 | `IMPL-L5-01` `IMPL-L5-03` | P2 |
| **REQ-D-03** | dev.to に公開できる | G-3 | `IMPL-L5-04` | P3 |
| **REQ-D-04** | 公開実績と反応が次のネタ検出に還る | G-3 | `IMPL-L5-06` | P3 |
| **REQ-D-05** | **Note / YouTube を後から追加できる** | G-3 | `IMPL-L5-01` `IMPL-L5-05` | P4 |
| **REQ-I-01** | Obsidian で閲覧・編集できる | G-2 | `IMPL-L6-01` | P0 |
| **REQ-I-02** | 他の AI クライアントから検索できる | G-2 | `IMPL-L6-02` `IMPL-L6-03` | P3/P4 |
| **REQ-N-01** | 常時起動マシンを必要としない | — | `IMPL-L0-02` `IMPL-L0-07` `IMPL-L0-08` | P0（設計・CLI は P0 から成立。自動化〔Actions〕は P1 で追加） |
| **REQ-N-02** | LLM 実行はサブスク定額に収まる | — | `IMPL-L3-04` `IMPL-L0-05` | P0 |
| **REQ-N-03** | スマホだけで捕捉と承認が完結する（**MVPでは「捕捉」＝Gemini、「承認」＝PR merge の2点のみが該当。中間の知識化・下書き作成〔digest/scout/draft〕はPC上のClaude Codeが必要**。IMPL-L3-04 参照） | G-1/G-3 | `IMPL-L1-04` `IMPL-L4-04` | P1/P2 |
| **REQ-N-04** | 第三者が自分の基盤として複製できる | — | `IMPL-L0-10` | P4 |
| **REQ-N-05** | 将来 Notion 等へ移植できる | — | `IMPL-L0-02` `IMPL-L2-01` `IMPL-L6-04` | P4（**L1/L5 のみポート差し替えで対応。L3 は対象外で書き直しが要る**。IMPL-L0-02 参照） |
| **REQ-N-06** | 1 つのパスを書くサービスは常に 1 つに保たれる | — | `IMPL-L0-03` `IMPL-L0-04` | P0 |
| **REQ-N-07** | 障害が握り潰されず可視化される | — | `IMPL-L0-05` `IMPL-L0-06` | P1/P3 |
| **REQ-N-08** | **全プロジェクトから使える（ユーザーレベル導入）** | G-1 | `IMPL-L0-07` | P0 |

### 2.3 逆引き

各実装アイテムがどの要件を根拠に存在するかは、第 5 章に `根拠` として記載する。**根拠のない実装アイテムは作らない。**

**§2.2 の「実装アイテム」列と第 5 章の「根拠」欄の関係**: §2.2 の列は当該要件の実現に**関与する**実装アイテムを広く示す。各実装アイテム自身にとっての第一義的な存在理由は第 5 章の「根拠」欄を正とする（狭義）。両者は一致しないことがある（例: `IMPL-L1-01` は REQ-C-02 の実現にも関与するが、`IMPL-L1-01` 自身の根拠は REQ-C-05 等であり REQ-C-02 は含まれない）。

---

## 3. システム構成

### 3.1 リポジトリ構成（3 つ。サブモジュールは使わない）

| # | リポジトリ | 可視性 | 中身 | 会話ログ・個人情報 | 人間が触るか |
|---|---|---|---|---|---|
| 1 | `work-stream`（プラットフォーム） | **public** | **コードのみ**（npm パッケージ群 + 再利用可能ワークフロー + CLI） | **一切入らない** | 開発時のみ |
| 2 | `knowledge-repo` | **private** | データすべて（inbox / notes / moc / log / profile / articles / .system） | 入る | **常時。Obsidian で開くのはここ** |
| 3 | Zenn 接続用リポ | **private** | 公開すると決めた Zenn 記事のみ | 入らない | **触らない**（Actions が生成・push） |

**サブモジュールを使わない理由**: サブモジュールは「他リポジトリのソースを自分の作業ツリーに固定コミットで置く」ための道具であり、今回の 2 つの関係はどちらもそれではない。

| 関係 | 性質 | 仕組み |
|---|---|---|
| knowledge-repo → プラットフォーム | ビルド済み成果物への**依存** | **npm パッケージ**（グローバル CLI）+ **再利用可能ワークフロー**（`workflow_call`） |
| knowledge-repo → Zenn 接続用リポ | 生成物の**デプロイ**（一方通行） | Actions からの **push**（gh-pages と同型） |

サブモジュールにすると、プラットフォームのソース一式が knowledge-repo 内に展開され、**Obsidian がそれを vault の一部として認識してしまう**（ノート検索に `.ts` が混ざる）。またバージョン固定がコミット SHA になり semver も changelog も効かない。

knowledge-repo に入るプラットフォーム由来のものは、**数行のワークフロースタブだけ**である。

```yaml
# knowledge-repo/.github/workflows/ingest.yml — 実体はこれだけ
jobs:
  ingest:
    # v1 タグではなくコミット SHA でピン留めする（可動タグは差し替えられうるため）
    uses: umiji/work-stream/.github/workflows/ingest.yml@<pinned-sha>
    secrets:
      # secrets: inherit は使わない。work-stream は public リポであり、
      # 全 secrets を渡すと workflow 定義の改変や ref 差し替えで漏洩しうる。
      # 必要な secret だけを名前指定で渡す。
      GH_INGEST_TOKEN: ${{ secrets.GH_INGEST_TOKEN }}
```

**`secrets: inherit` を使わない理由**: `work-stream` は public であり、`secrets: inherit` は knowledge-repo が持つ全 secrets（`CLAUDE_CODE_OAUTH_TOKEN`、X の API キー、Zenn 接続用リポへの PAT、GAS 用 PAT を含む）を、public な `work-stream` 側で管理されるワークフロー定義にまとめて渡すことになる。参照が可動タグ（例: `@v1`）だと、タグの向き先が差し替えられた場合に secrets を任意の宛先へ送出するコードへ改変されうる。ワークフローごとに必要な secret のみを名前指定で渡し、参照はコミット SHA で固定する。

### 3.2 レイヤー構成

中心は L2 Brain Layer（知識層）であり、他のすべての層は「Brain に入れる」「Brain を育てる」「Brain から出す」「Brain を見る」のいずれかを担う。

```
┌─────────────────────────────────────────────────────────────────────┐
│ L6  Interface Layer  — 人と AI が Brain に触れる層                   │
│     Obsidian(閲覧/編集)  GitHub Web/Mobile(承認)  MCP(AI からの検索)  │
└─────────────────────────────────────────────────────────────────────┘
              ▲                    ▲                    ▲
┌─────────────────────────────────────────────────────────────────────┐
│ L5  Distribution Layer — Brain から外部メディアへ出す層               │
│     deliver: zenn / x / devto      export: note / youtube            │
│     metrics(反応の回収)                                               │
└─────────────────────────────────────────────────────────────────────┘
              ▲ merge を契機に起動
┌─────────────────────────────────────────────────────────────────────┐
│ L4  Governance Layer — 出す前に止める層（唯一「拒否」できる層）        │
│     policy: 一般秘匿情報 / 外部由来 verbatim / profile の個人固有 NG   │
│     PR 承認 + branch protection                                      │
└─────────────────────────────────────────────────────────────────────┘
              ▲ PR として提出
┌─────────────────────────────────────────────────────────────────────┐
│ L3  Agent Layer — Brain を育て、Brain から素材を立ち上げる層          │
│     digest(知識化・ノート育成)  scout(ネタ検出)  draft(ドラフト生成)   │
│     実体: Claude Code（MVP はスラッシュコマンド起動）                  │
└─────────────────────────────────────────────────────────────────────┘
              ▲ 読み書き
╔═════════════════════════════════════════════════════════════════════╗
║ L2  Brain Layer  ★ 唯一の正（SoT）★                                ║
║     knowledge-repo (private) — プレーン Markdown + frontmatter       ║
║     inbox/  notes/<domain>/  moc/  log/  profile/  articles/<media>/ ║
╚═════════════════════════════════════════════════════════════════════╝
              ▲ ここに書けるのは ingest ただ 1 つ
┌─────────────────────────────────────────────────────────────────────┐
│ L1  Capture Layer — 外を正規形に変えて Brain に入れる層               │
│     ingest（冪等受付・唯一の書き手）                                  │
│       ← connector-manual   connector-claude-code                     │
│       ← ingress-issue（GAS / 手動の汎用受け口）                       │
│       ← connector-export（Takeout / エクスポート ZIP）                │
└─────────────────────────────────────────────────────────────────────┘
              ▲
   [Claude Code(全プロジェクト)] [Gemini→Docs→GAS] [手動メモ] [Export ZIP]
┌─────────────────────────────────────────────────────────────────────┐
│ L0  Platform Layer — 全層を支える基盤                                │
│     Git as Event Log   GitHub Actions   contracts(Zod)               │
│     ユーザーレベル導入   ownership-guard   visibility-guard           │
│     .system/runs(観測)   DLQ                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 貫く 5 つの原則

| # | 原則 | 効果 |
|---|---|---|
| P-1 | **Brain（Git の Markdown）が唯一の正**。Obsidian も Notion も View に過ぎない | ストア抽象化で機能が最小公倍数に縛られる問題を回避。基盤ごとの分岐がコアから消える |
| P-2 | **1 つのパスを書くサービスは 1 つだけ** | 競合が構造的に起きない。誰が壊したかが常に一意 |
| P-3 | **サービス中核は純関数。Git も Actions も知らない**（適用範囲は L1・L5 に限定。**L3 は対象外**——理由は IMPL-L3-01 を参照） | 将来ネットワーク型へ移す際、L1・L5 は transport アダプタの差し替えで済む。**L3 は書き直しが要る**（意図的なトレードオフ） |
| P-4 | **状態遷移は明示イベントで表す** | 外部 AI クライアントは Git 履歴も PR も読めない。ファイル単体で意味が完結する |
| P-5 | **構造はフォルダではなくリンクと MOC が担う** | 知識は多次元。フォルダは 1 つしか選べないので、階層を切ると分類をどれか捨てることになる |

### 3.4 Gemini からの取り込み（MVP で唯一の自動ジョブ）

**Gemini には書き込み口が無い**（GitHub 連携は読み取り専用、MCP 非対応）。そこで Gemini 側に何も期待せず、**Gemini 自身に要約させて Google Docs へ出す**という標準機能だけを使う。

```
① Gemini アプリ（Android / PC）で検討・調べ物・雑談をする
        │
        ▼  「この会話を要約して」と指示
② Gemini が要約を生成（★ここで前段圧縮が起きる）
        │
        ▼  「Google ドキュメントにエクスポート」
③ Google Drive の指定フォルダに Doc が生成される
        │
        ▼  GAS の時間主導トリガ（5〜10 分間隔）でフォルダをスキャン
④ GAS: 新規 Doc を検出 → 本文テキストを取得 → GitHub API で Issue 作成
        │        （GAS はここまで。整形も分類も一切しない = 薄い中継）
        ▼  issues.opened
⑤ GitHub Actions 起動 → ingress-issue が CapturedItem を組み立て
        │
        ▼
⑥ ingest が inbox/ へ commit（sourceId で冪等）→ Issue を自動クローズ
        │
        ▼  /digest（手動起動）
⑦ digest が atomic note 化して notes/<domain>/ へ
```

| 論点 | この設計が効く理由 |
|---|---|
| 会話まるごとのノイズ | ②で **Gemini 自身が圧縮する**。冗長な AI 応答がパイプラインに入る前に消える |
| Max 使用量枠の圧迫 | 同上。digest に渡る入力量が数分の 1 になる |
| スクレイピングのリスク | 一切なし。Gemini 標準機能と Google 公式 API のみ |
| 常時起動 | 不要。GAS の時間主導トリガと Actions だけ |
| GAS の保守リスク | GAS は「Doc の本文を取って投げる」だけ。壊れても影響範囲が最小 |
| トークン漏洩 | GAS が持つ GitHub トークンは `Issues: Write` のみ。**漏れても知識ベースは読めない** |

**なぜ `repository_dispatch` ではなく Issue か**: `repository_dispatch` を叩くには fine-grained PAT に `Contents: Write` が必要になり、GAS 上のトークンにリポジトリ全体の書込権を持たせることになる。Issue 作成なら `Issues: Write` だけで済み、最小権限が保てる。Issue は人間向け UI ではなく**機械用トランスポート**として使い、成功時は自動クローズされる。

### 3.5 取り込み経路の一覧

| ソース | 経路 | 摩擦 | 自動/手動 | 要件 |
|---|---|---|---|---|
| **Claude Code（全プロジェクト）** | `/capture` → CLI → ingest | ゼロ | 手動 | REQ-C-01 |
| **Gemini** | 要約 → Docs → Drive → GAS → Issue → ingest | Gemini に一言 + エクスポート 1 タップ | **自動** | REQ-C-02 |
| Claude チャット | 得た知識を Claude Code に話して登録 | 一言 | 手動 | REQ-C-03 |
| 手動メモ | `/capture` | ゼロ | 手動 | REQ-C-04 |
| 任意のアプリ | GitHub Issue を直接立てる | 手動 | 自動処理 | REQ-C-07 |
| 過去分の一括 | Takeout / エクスポート ZIP | バッチ | 手動 | REQ-C-06 |

---

## 4. 各レイヤーの構成技術・要素

### L0 Platform Layer（基盤層）

**役割**: 全層に共通する実行基盤・契約・保全機構を提供する。

| 要素 | 技術 | 選定理由 |
|---|---|---|
| イベントログ | **Git**（`.system/events/<yyyy>/<mm>/<ULID>.json`、append-only） | 追加専用・ファイル名一意なので**並行 push しても内容衝突が構造的に起きない**。監査ログが無料でつく |
| オーケストレーション | **GitHub Actions** + **スラッシュコマンド** | MVP で自動化するのは Google Docs 取込の 1 本だけ。他は手動起動（REQ-N-01, REQ-N-02） |
| LLM 実行 | **Claude Code**（MVP はローカル対話、P2 以降 headless + `CLAUDE_CODE_OAUTH_TOKEN`） | サブスク定額。手動起動なので消費量を自分で制御できる |
| 契約定義 | **TypeScript + Zod** | 実行時検証と型が 1 か所で済む。**全サービスが共有する唯一のコード** |
| モノレポ | **pnpm workspaces + changesets** | サービスごとに独立バージョニング＝独立デプロイ |
| テスト | **vitest** | 純関数中心なので unit で大半を賄える |
| 所有権強制 | **CI（ownership-guard）** | 規約ではなく実行可能な制約にする（REQ-N-06） |
| 情報漏洩防止 | **CI（visibility-guard）+ 合成 fixture 強制** | private データが public へ出る事故を機械的に防ぐ（REQ-P-04） |
| 観測 | `.system/runs/<svc>/<runId>.json` | 実行記録・**消費トークン量**を残し、Max 枠の実測に使う |
| 失敗隔離 | `.system/dlq/<svc>/` + Issue 自動起票 | 握り潰しを防ぐ（REQ-N-07） |

### L1 Capture Layer（取込層）

**役割**: 外部の雑多な入力を `CapturedItem` という単一の正規形に変え、Brain へ入れる。

| 要素 | 技術 | 備考 |
|---|---|---|
| 正規形 | `CapturedItem`（Markdown + frontmatter、Zod 定義） | すべてのソースがこの形に落ちる |
| 冪等キー | `sourceId` | 同じものを何度投入しても 1 件（REQ-C-05） |
| Gemini 中継 | **Google Apps Script**（時間主導トリガ + Drive API + UrlFetchApp） | **薄い中継に限定**。GAS は CI もテストも効かないため責務を最小化 |
| 汎用受け口 | **GitHub Issue**（label: `capture`） | 機械用トランスポート。`Issues: Write` のみで動く |
| 一括取込 | ZIP パーサ（Takeout / ChatGPT / Claude） | pull 型を一級市民として扱う |

> **重要**: コネクタはリポジトリに書き込まない。`CapturedItem` を作るだけで、**永続化は必ず `ingest` が行う**。起動契機が何であれ経路が 1 本になり、冪等・イベント発行・所有権が自動的に守られる。

### L2 Brain Layer（知識層）★中核★

**役割**: すべての知識を保持する唯一の正。**プレーン Markdown + frontmatter を private Git リポジトリに格納する。**

#### ディレクトリ構成

「**人間が見る知識**」と「**システムが持つ状態**」を明確に分離する。ラベル・指標・公開記録はシステム側の関心事であり、Obsidian で読むものではない。

```
knowledge-repo/  (private)
├── inbox/                # 未処理キャプチャ（処理待ちの山）
├── notes/                # ★知識の本体（atomic notes）
│   ├── tech/             #   ドメインは 1 階層のみ。ネスト禁止
│   ├── product/          #   ドメインの中身は .system/config で定義する
│   └── ...               #   （どう分けるかは利用者が決める）
├── moc/                  # テーマ別ハブ。★構造の主役
├── log/                  # 時系列の記録
├── profile/              # ★自分は何者か（人間が書き、LLM が読む散文）
│   ├── who.md            #   経歴・専門・立場・読者に対する位置
│   ├── voice.md          #   文体・トーン・言い回しの癖・使わない言葉
│   ├── themes.md         #   発信したいテーマ / 触れないテーマ
│   └── ng.md             #   公開不可（所属・実名・NDA 領域・関係者）
├── articles/             # 成果物（PR 中 = ドラフト / マージ済 = 公開）
│   ├── zenn/             #   <slug>.md
│   ├── x/                #   <slug>.md
│   ├── devto/            #   <slug>.md
│   ├── note/             #   MVP 後
│   └── youtube/          #   MVP 後（<slug>/ のディレクトリ単位）
└── .system/              # システム内部状態（Obsidian からは隠す）
    ├── config/           #   ドメイン定義・チャネル定義・閾値
    ├── events/           #   イベントログ
    ├── state/<svc>/      #   チェックポイント
    ├── classification/   #   公開可否ラベル
    ├── proposals/        #   発信ネタ候補・ノート統合候補
    ├── publications/     #   実際に投稿した URL・日時
    ├── metrics/          #   反応指標
    ├── runs/             #   実行記録・消費トークン
    └── dlq/              #   失敗の隔離
```

**人間が見るトップレベルは 6 つ**（inbox / notes / moc / log / profile / articles）。所有権はディレクトリの深さと無関係に維持できるため、`.system/` に畳んでも P-2 原則は崩れない。

**`drafts/` を持たない理由**: 「ドラフト」と「公開済み」の違いは *場所* ではなく *PR がマージされたかどうか* である。移動という操作自体が不要（Zenn も frontmatter の `published: false` で下書きを表現できる）。

#### 構造化の方針

| 要素 | 技術・形式 | 備考 |
|---|---|---|
| ストア | **private GitHub リポジトリ** | 無料。バージョン管理・PR・モバイルが全部ついてくる |
| フォーマット | **Markdown + YAML frontmatter** | Obsidian・GitHub・AI クライアントのすべてが読める最大公約数 |
| ノート粒度 | **atomic note**（1 ノート 1 アイデア） | リンクしやすく、再利用でき、AI 検索の命中精度が上がる |
| **フォルダ（1 階層）** | `notes/<domain>/` | **排他的な置き場**。「どこに住んでいるか」。**エージェント検索の絞り込みに効く**（全件 Grep より命中精度もトークン消費も改善する） |
| **MOC** | `moc/<theme>.md` | **非排他的な入口。構造の主役。** 1 ノートが何個の MOC に出てもよく、見出しで章立てでき順序も持てる |
| タグ | `frontmatter.tags` | **最小限に留める**。構造化は MOC に寄せる（タグは MOC の下位互換であり、放置すると増えて破綻する） |
| 命名 | `notes/<domain>/<kebab-case-slug>.md` | ID 番号は使わない。Git と全文検索がある以上、可読性が勝つ |
| リンク記法 | **標準 Markdown 相対リンク** | Obsidian 独自の `[[...]]` は GitHub でも外部 AI でも解決されない |
| 検索 | **agentic search**（Grep / Glob + MOC を起点） | RAG インフラは作らない。数千件を超えてから検討 |

#### ディレクトリ所有権（機械の書き手は常に 1 サービス。人間は別アクターとして扱う）

`profile/` を除き、**人間（Obsidian 経由の直接編集など、commit trailer を持たない操作）はどのパスも上書きしてよい**。ownership-guard（IMPL-L0-04）が強制するのは「機械的な書き手が競合しないこと」であり、人間の編集を禁止する仕組みではない。

| パス | 機械の書き手 | 読み手 | 人間の直接編集 |
|---|---|---|---|
| `inbox/` | `ingest` | digest | 可（緊急時の手動投入等） |
| `notes/` `moc/` `log/` | `digest` | scout, draft, mcp | **可（Obsidian での通常編集を想定。REQ-I-01）** |
| `profile/` | **人間のみ** | scout, draft, policy | 可（唯一の正規の書き手） |
| `articles/<media>/` | `draft`（PR 上） | publish-*, export-* | 可（PR 上での加筆） |
| `.system/classification/` | `policy` | draft, publish-*, mcp | 不可 |
| `.system/proposals/merge/` | `digest` | draft, 人間 | 不可 |
| `.system/proposals/topics/` | `scout` | draft, 人間 | 不可 |
| `.system/publications/` | `publish-*` / `export-*` | scout, metrics | 不可 |
| `.system/metrics/` | `metrics` | scout | 不可 |
| `.system/events/` | 全サービス（**追加のみ**） | 全サービス | 不可 |
| `.system/state/<svc>/` | 当該サービスのみ | 当該サービスのみ | 不可 |

**`.system/proposals/` のサブパス分離（重要）**: `digest`（統合候補）と `scout`（発信ネタ候補）は元は同じ `.system/proposals/` を書く設計だったが、これは「1 パス 1 書き手」原則（P-2）と矛盾する。`merge/` と `topics/` にサブパスを分け、ownership-guard がこの粒度で照合できるようにする。

### L3 Agent Layer（エージェント層）

**役割**: Brain を育て、Brain から発信素材を立ち上げる。**このレイヤーだけが LLM を使う。**

| 要素 | 技術 | 備考 |
|---|---|---|
| 実行体 | **Claude Code** | サブスク定額。API 従量にしない |
| 指示 | **`~/.claude/skills/`**（ユーザーレベル）+ `AGENTS.md`（Codex 併用） | digest / scout / draft の 3 スキル |
| **起動（MVP）** | **スラッシュコマンド**（`/capture` `/digest` `/scout` `/draft`） | やりたいときにやる。**Max 枠の消費を自分で制御できる** |
| 起動（P2 以降） | 必要に応じて cron 化（`setup-token` はこの時点で導入） | バッチが対話利用と枠を食い合う問題を実測してから判断 |

#### 由来による処理の分岐

| captureKind / origin | 内容 | digest の扱い | scout の扱い |
|---|---|---|---|
| **`thought`** / `self` | 自分の思考の産物（気づき・検討の結論・ディスカッションの着想・雑談中の発想） | atomic note 化 | **発信ネタの主対象** |
| **`reference`** / `external` | 外部から得た知識（Gemini 等の説明） | atomic note 化 + `origin: external` を明示 | **単独では提案しない**。thought を支える裏取り・引用としてのみ使う |
| **`log`** / `self` | 時系列の記録（やったこと、試して失敗したこと、判断とその状況） | `log/` へ。**概念部分は抽出して notes へ** | 振り返り系アウトプットの素材 |

`log/` と `notes/` を分ける理由は 2 つ。**日付依存の記述が atomic note の再利用性を壊すこと**と、**出来事の記録自体が振り返り記事の素材として価値を持つこと**。

### L4 Governance Layer（統制層）

**役割**: 外へ出る前に止める。**「公開コンテンツの内容」を理由に拒否できるのはこのレイヤーのみ**（L0 の ownership-guard・visibility-guard も違反時に CI を止めるが、これらは「構造・可視性」を理由とする別種のゲートであり、L4 とは対象が異なる）。

| 要素 | 技術 | 備考 |
|---|---|---|
| 承認 | **GitHub Pull Request** | ドラフト 1 本 = PR 1 本。GitHub Mobile で外出先から承認できる |
| 強制 | **publish-\* による公開直前検証**（IMPL-L5-02〜04） | `main` へのブランチ保護は使わない（articles/ 以外の直接 push も道連れでブロックされるため）。`policy` が通っていない記事は、たとえ merge されても外部へは送信されない |
| 一般秘匿検出 | `policy`（パターン + LLM 判定の二段） | 鍵・トークン・個人情報など |
| **個人固有 NG** | `policy` が **`profile/ng.md` を読む** | 「所属先の名前」「まだ公にしていない話」のような**この人にとっての地雷**を判定する |
| 外部由来ブロック | `policy` | `origin: external` の verbatim 公開を止める。引用は可、コピーは不可 |

### L5 Distribution Layer（配信層）

**役割**: 承認された成果物を外部メディアへ出す。

#### 配信の 2 種別

| 種別 | 対象 | 動作 |
|---|---|---|
| **deliver**（自動配信） | Zenn / X / dev.to | API・push で自動投稿し、URL を記録 |
| **export**（半自動） | **Note / YouTube** | 人間が貼れる形に整形して出力。投稿は人間。投稿後に URL を記録 |

Note / YouTube を自動化しないのは規約・破損リスクのためだが、**同じ器・同じ承認フローには乗せる**。自動化しないのは最後の一手だけ。

#### チャネル定義

チャネルは `.system/config/channels.yml` で宣言し、追加は定義 + サービス 1 本で済む形にする。

```yaml
zenn:    { mode: deliver, artifactShape: file,      target: separate-repo }
x:       { mode: deliver, artifactShape: file,      target: api }
devto:   { mode: deliver, artifactShape: file,      target: api }
note:    { mode: export,  artifactShape: file }
youtube: { mode: export,  artifactShape: directory }   # script.md / description.md / assets/
```

**`artifactShape` が重要**: 記事は Markdown 1 本だが、動画は台本・説明文・サムネ・素材の複合になる。この差を最初から器に持たせておかないと、YouTube を後から乗せる際に構造が合わなくなる。

#### コスト

| チャネル | コスト |
|---|---|
| Zenn | 無料（GitHub 連携が push を拾って公開） |
| X | **pay-per-use**。$0.015/post、リンク付き $0.20/post、read $0.005/件 |
| dev.to | 無料 |
| Note / YouTube | 無料（投稿は人間） |

> **コストの整理**: 「定額運用」の趣旨は **LLM のエージェント従量課金の回避**であり、配信 API の微少な従量（月数ドル）は別枠として許容する。

### L6 Interface Layer（対話層）

| 要素 | 技術 | 用途 |
|---|---|---|
| 閲覧・編集 | **Obsidian**（obsidian-git で同期） | knowledge-repo をそのまま vault として開く。移植作業は不要 |
| 承認 | **GitHub Web / Mobile** | PR レビュー・加筆・マージ |
| AI からの検索 | **MCP サーバ**（stdio → remote） | ローカル stdio なら**常時起動不要・認証不要で定額を維持できる** |
| Notion | **片方向ミラー**（repo → Notion） | 双方向は非可逆変換と競合解決の問題があるため持たない |

---

## 5. 実装内容（レイヤー別・実装 ID 別）

書式: **目的 / 成果物 / 仕様 / 検証 / 根拠要件 / Phase**

### L0 Platform Layer

#### IMPL-L0-01 — contracts パッケージ
- **目的**: 全サービスが共有する唯一のコード。データ契約を 1 か所に固定する
- **成果物**: `packages/contracts/`
- **仕様**: `CapturedItem` / `Event` エンベロープ / 各イベント payload を Zod で定義

```yaml
# CapturedItem frontmatter
sourceType:        claude-code | gemini | claude-chat | chatgpt | manual | issue
sourceId:          "gdoc#1AbC...xyz"          # 冪等キー
captureKind:       thought | reference | log
origin:            self | external
capturedAt:        2026-07-28T09:00:00+09:00
originalTimestamp: 2026-07-27T22:14:00+09:00
correlationId:     "01J8ZQ..."               # inbox→公開 を貫通する追跡 ID
sourceRef:
  docUrl:          "https://docs.google.com/document/d/..."
  conversationUrl: "https://gemini.google.com/app/..."   # 取得できた場合のみ
  project:         "my-app"                   # どの開発プロジェクト由来か
tags: []
```

```json
// Event エンベロープ
{
  "eventId": "01J8ZQ...",
  "type": "Ingest.ItemCaptured",
  "schemaVersion": "1.0.0",
  "occurredAt": "2026-07-28T09:00:00+09:00",
  "producer": "ingest@1.2.0",
  "dedupeKey": "gdoc#1AbC...xyz",
  "correlationId": "01J8ZQ...",
  "payload": {}
}
```

- **検証**: スキーマの往復変換と後方互換テスト
- **根拠**: REQ-K-02, REQ-K-05, REQ-C-05
- **Phase**: P0

#### IMPL-L0-02 — runtime-git（トランスポートアダプタ）
- **目的**: サービス中核から Git と Actions を隠す
- **仕様**: `EventBusPort`（append / readSince）、`ContentStorePort`（read / write）、`ClockPort`、`IdPort` の Git 実装。将来の `runtime-http` はこの隣に並ぶ
- **push の競合対策**: `ContentStorePort.write` の内部実装は `fetch origin → rebase → push` を 1 単位とし、push が non-fast-forward で拒否された場合は上限回数（例: 5 回）まで自動リトライする。**ファイル名が ULID で一意であることはファイル内容のマージコンフリクトを防ぐだけであり、Git の ref 更新自体の競合（複数の Actions 実行がほぼ同時に commit する場合の push 拒否）は防がない**ため、この仕組みを別途持つ。上限を超えて失敗した場合は DLQ（IMPL-L0-06）へ回す
- **検証**: 一時 Git リポジトリを使った統合テスト。**2 クローンから同一 remote へほぼ同時に push するケースを含め、リトライで両方成功することを確認する**
- **適用範囲の限定**: このポート抽象化は **L1（ingest）・L5（publish-*）にのみ適用する**。L3（digest/scout/draft）は対象外とし、Claude Code の Grep/Glob によるファイルシステム直接操作、および `git commit`（複数ファイルをまとめ trailer を付与する操作）に強く結合することを許容する。理由は IMPL-L3-01 を参照。将来 `runtime-http` へ移行する際、L1/L5 はポートの差し替えで済むが、**L3 は書き直しが必要になる**——既知のトレードオフとして受け入れる（YAGNI: 個人ツールの P0 でこの投下工数を割く価値は薄いと判断）
- **根拠**: REQ-N-01, REQ-N-05 / **Phase**: P0

#### IMPL-L0-03 — イベントログ
- **仕様**: `.system/events/<yyyy>/<mm>/<ULID>.json`。**追加のみ・更新削除なし**。消費側は `.system/state/<svc>/checkpoint.json` を持ち at-least-once + 冪等消費。月次コンパクション
- **検証**: 並行 push しても衝突しないことを統合テストで実証
- **根拠**: REQ-K-03, REQ-N-06 / **Phase**: P0

#### IMPL-L0-04 — ownership-guard（CI）
- **仕様**: コミット trailer のサービス名と、変更されたパスの所有権表を突き合わせ、違反したら CI を落とす。**commit trailer が無いコミットは `human` アクターとして扱う**（Obsidian の obsidian-git や、Claude Code との対話中にサービス trailer を付けずに行われる編集はこれに該当する）。所有権表（§4 L2）の各行は「機械の書き手は常に 1 つ」を強制する一方、`human` には別枠で許可パスを定める（既定: `.system/` 以外は編集可）
- **限界**: このガードは push 後に走る CI であり、直接 push 経路（ingest / digest 等）では**事後検知**にとどまる（落ちた時点で既にコミットは main に入っている）。required status check として機能するのは PR 経由の変更（articles/ 等、IMPL-L4-04）に限られる
- **検証**: 意図的な違反コミット（機械アクターが他サービスの領域に書く）で落ちること。**trailer の無い人間コミットが `notes/` 等の許可パスに対しては落ちないこと**
- **根拠**: REQ-N-06 / **Phase**: P0

#### IMPL-L0-05 — 観測
- **仕様**: 実行ごとに `startedAt` / `endedAt` / `eventsProcessed` / `errors` / **`tokensUsed`** を `.system/runs/` に記録
- **根拠**: REQ-N-02, REQ-N-07 / **Phase**: P1

#### IMPL-L0-06 — DLQ と監視
- **仕様**: N 回失敗した項目を `.system/dlq/<svc>/` へ隔離し、空でなければ Issue を自動起票
- **根拠**: REQ-N-07 / **Phase**: P3

#### IMPL-L0-07 — ユーザーレベル導入 ★これが無いと 1 リポジトリでしか動かない★
- **目的**: **どの開発プロジェクトで作業していても捕捉できるようにする**
- **成果物**: `packages/cli/`（グローバル CLI）+ インストーラ
- **仕様**: インストーラが以下を配置する

```
~/.claude/commands/                 # /capture /digest /scout /draft
~/.claude/skills/                   # digest / scout / draft の指示
~/.config/work-stream/config.json   # knowledge-repo の場所
ws CLI                              # npm グローバルインストール
```

```json
// ~/.config/work-stream/config.json
{ "knowledgeRepo": "/Users/kaiki/knowledge-repo", "defaultDomain": "tech" }
```

- **動作**: 別プロジェクトで `/capture` を実行すると、CLI が config を読んで knowledge-repo の `inbox/` へ書き、commit + push する。`sourceRef.project` に現在のプロジェクト名を自動付与する
- **コマンドごとの性質**（正直な制約）:

| コマンド | どこから使えるか | 理由 |
|---|---|---|
| **`/capture`** | **どのプロジェクトからでも** | CLI が別ディレクトリへ書くだけ。作業ディレクトリの制約を受けない |
| `/digest` `/scout` `/draft` | knowledge-repo を開いて実行 | 大量のノートを読み書きするため、そこを作業ディレクトリにする方が自然 |

- **検証**: 無関係なプロジェクトディレクトリで `/capture` を実行し、knowledge-repo に反映されること
- **根拠**: REQ-N-08, REQ-C-01 / **Phase**: **P0**

#### IMPL-L0-08 — Actions ワークフロー群
- **仕様**: MVP で自動化するのは `ingress-issue.yml`（`issues.opened`）**の 1 本だけ**。これは Issue → Markdown の機械的変換で **LLM を使わないため、標準の `GITHUB_TOKEN` だけで動く**（`setup-token` は P2 まで不要）。P2 以降に `policy.yml`(PR gate) / `publish.yml`(merge) / cron 化した digest・scout を追加
- **根拠**: REQ-N-01, REQ-C-02 / **Phase**: P1〜

#### IMPL-L0-09 — 情報漏洩防止ガード
- **目的**: private データが public リポジトリへ出る事故を機械的に防ぐ
- **仕様**:

| ガード | 内容 |
|---|---|
| **visibility-guard** | knowledge-repo のワークフローで `repository.private` を検査し、public になっていたら即座に失敗させて Issue を起票する。**ただし、これは検知であり予防ではない**: GitHub の仕様上 private→public の切り替えはその瞬間に過去の全コミット・全 Issue・全 Actions ログを閲覧可能にするため、切り替え自体は防げず、切り替わってから次にワークフローが実行されるまでの間は検知できない。他のトリガーに依存しないよう、**日次 cron で独立してこのチェックだけを走らせる**ワークフローを別途持つ |
| **合成 fixture 強制** | 契約テスト用サンプル（public なプラットフォームリポに入る）を実データから作ることを禁止する運用ルールとする。**work-stream は knowledge-repo への読み取りアクセスを設計上持たないため、「実データ由来かどうか」を CI が自動判定する手段は無い**。実効性があるのは「fixture は必ず生成スクリプト経由で作る／手書き追加は PR レビューで拒否する」という人間のレビュー運用であり、機械的な保証ではないことを明記しておく |

- **公開経路**: 外部への公開は `publish-zenn`（Zenn 接続用リポへの push）・`publish-x`（X API）・`publish-devto`（dev.to API）の 3 経路があり、**いずれも `articles/<media>/` への PR merge を共通の起点とし、policy（一般秘匿 + `profile/ng.md` + verbatim 検出）と人間の PR 承認の両方を必ず経由する**。Zenn 接続用リポ自体も private であり（§3.1）、Zenn 側の公開処理が実質的な public 化の実体である
- **根拠**: REQ-P-04 / **Phase**: P1（`work-stream` のワークフロー〔IMPL-L0-08〕が存在して初めて public への露出経路が生まれるため。P0 は手元 CLI と knowledge-repo への commit のみで完結し、public 化の対象となる Actions・reusable workflow が存在しない）

#### IMPL-L0-10 — 第三者向け配布
- **仕様**: `create-knowledge-repo` scaffolder + reusable workflow の v1 タグ + セットアップ文書 + `setup-token` ローテーション手順
- **根拠**: REQ-N-04 / **Phase**: P4（機構自体は IMPL-L0-07 で P0 から存在する）

---

### L1 Capture Layer

#### IMPL-L1-01 — ingest（唯一の書き手）
- **目的**: すべての取り込みを 1 本の経路に集約し、冪等性と所有権を担保する
- **仕様**: `CapturedItem` を受け取り、`sourceId` の冪等判定を行った上で新規なら `inbox/` へ commit し `Ingest.ItemCaptured` を発行。`correlationId` をここで採番する
- **冪等判定の実装**: `.system/state/ingest/seen.ndjson` への追記・突合は**採用しない**（1 ファイルへの read-modify-write のため、並行実行時に両方が「未取込」と誤判定し重複が生まれる）。代わりに `.system/state/ingest/seen/<sha256(sourceId)>` という**パス自体が一意な 0 バイトマーカーファイル**の存在有無で判定する。ファイル作成の衝突は Git のパスレベルで自然に検出できるため、内容マージが不要になる
- **検証**: 同一 `sourceId` を 10 回投入して 1 件しか増えないこと。**加えて同一 `sourceId` を持つ 2 リクエストを並行実行しても 1 件しか増えないこと**（逐次テストでは検出できないため別ケースとして必須）
- **根拠**: REQ-C-05, REQ-K-05, REQ-N-06 / **Phase**: P0

#### IMPL-L1-02 — connector-manual
- **仕様**: `/capture` または `ws capture --kind thought` で標準入力・ファイルから取り込む
- **根拠**: REQ-C-04 / **Phase**: P0

#### IMPL-L1-03 — connector-claude-code
- **目的**: 開発中の検討・気づき、および Claude チャットで得た知識の登録口
- **仕様**: `~/.claude/projects/*.jsonl` を読み、`sourceId = <conversationId>#<messageId>` で正規化。ディレクトリ名からプロジェクトを判定して `sourceRef.project` に入れる。対話的に「これをナレッジに入れて」と指示された内容も同経路
- **補足**: Claude チャットの取り込み（REQ-C-03）は**専用実装を作らずこの経路で代替する**。Claude Code は既にリポジトリを書けるため新規実装がゼロで済む
- **根拠**: REQ-C-01, REQ-C-03 / **Phase**: P0

#### IMPL-L1-04 — gas-relay（Gemini 中継）★MVP で唯一の自動ジョブ★
- **目的**: Gemini の会話を、スクレイピングも常時起動もなしに取り込む
- **成果物**: `gas/relay.gs` + セットアップ手順
- **仕様**:
  1. **時間主導トリガ**（5〜10 分間隔）で Drive の指定フォルダをスキャン（**GAS に「ファイル作成時」トリガは存在しない**ため）
  2. `ScriptProperties` のチェックポイント以降に作られた Doc を検出
  3. `DocumentApp` で本文テキストを取得
  4. GitHub REST API で Issue を作成（label: `capture`、body に本文と Doc の ID・URL）
  5. **Issue 作成が成功した直後に、その Doc 単位でチェックポイントを更新する**（GAS の実行時間上限 6 分内でタイムアウトし得るため、ステップ 4 と 5 はできる限り近接させ、複数 Doc をまとめて処理する場合は 1 件ごとに逐次更新する）
- **責務の限界**: **整形・分類・Markdown 変換は一切しない。** GAS は CI もテストもバージョン管理も効かない領域であり、責務量がそのまま保守リスクになるため意図的に薄い中継に留める
- **認証**: GitHub fine-grained PAT を `ScriptProperties` に格納。権限は**対象リポジトリ 1 つの `Issues: Read and write` のみ**。`Contents` は付与しない。**ただし `Issues: Read and write` は Issue の新規作成だけでなく、そのリポジトリの全 Issue（起票済みのエラー通知等を含む）を読む権限でもある点に注意する**。DLQ（IMPL-L0-06）やエラー通知の Issue 本文には、取り込み本文の全文など private なコンテンツを含めず `correlationId` など参照 ID のみを載せる
- **未検証事項**: Gemini の「Google ドキュメントにエクスポート」の出力先フォルダと、会話全体かレスポンス単位かの挙動。**P1 の最初の 30 分で実測する**。フォルダが固定でない場合は「最近作成された Doc を名前パターンで拾う」方式に切り替える（設計への影響なし）
- **検証**: Doc を手動で置いて Issue が立つこと、同じ Doc で 2 回発火しても 1 件しか入らないこと。**チェックポイント更新前にタイムアウトした場合を模擬し、同じ Doc から 2 本目の Issue が立っても ingest 側（IMPL-L1-05）で重複除去されることを確認する**
- **根拠**: REQ-C-02, REQ-N-01, REQ-N-03 / **Phase**: P1

#### IMPL-L1-05 — ingress-issue（汎用受け口）
- **仕様**: `issues.opened`（label: `capture`）を契機に起動。本文から URL とテキストを抽出して `CapturedItem` を組み立て `ingest` へ渡す。成功したら保存先パスをコメントして Issue を自動クローズ
- **`sourceId` の採番規則**: `sourceId` は**上流コンテンツの不変な同一性**を表すものと定義を固定する（トランスポート＝Issue 由来の値にはしない）。本文に Doc URL が含まれる場合は `gdoc#<Doc ID>` を採番する（IMPL-L1-04 の GAS が同じ Doc から重複して Issue を立てても、この時点で 1 件に収束させるため）。Doc URL が取得できない場合（人間が手で汎用 Issue を立てたケース等）に限り `github-issue#<number>` にフォールバックする
- **要約 + 原文リンクの扱い**: 本文を content に、Doc URL と（本文中にあれば）会話 URL を `sourceRef` に格納する
- **根拠**: REQ-C-02, REQ-C-07 / **Phase**: P1

#### IMPL-L1-06 — connector-export（一括取込）
- **仕様**: 1 サービス + パーサ 3 種（Google Takeout / ChatGPT `conversations.json` / Claude エクスポート）。`sourceId` により既取込分は自動的に破棄されるため何度実行しても安全
- **根拠**: REQ-C-06 / **Phase**: P3

---

### L2 Brain Layer

#### IMPL-L2-01 — リポジトリ構成
- **仕様**: 4 章 L2 のディレクトリ構成のとおり。**プラットフォーム（public）・knowledge-repo（private）・Zenn 接続用（private）の 3 リポジトリに分離**し、サブモジュールは使わない
- **根拠**: REQ-N-04, REQ-N-05, REQ-P-04 / **Phase**: P0

#### IMPL-L2-02 — note スキーマと命名規則
- **仕様**: `notes/<domain>/<kebab-case-slug>.md`。frontmatter に `origin` / `captureKind` / `correlationId` / `sourceRef` / `updatedAt` を持ち、**ノート単体を読むだけで由来が判る**ようにする。ID 番号は使わない。**公開可否そのものは `.system/classification/`（`policy` が P2 で書く）に持ち、note の frontmatter は判断材料〔`origin` 等〕を提供するに留まる**
- **タイトル変更時**: リンクが壊れるため、`digest` がリンクの張り替え責務を持つ
- **`PublicArticle` スキーマ（`articles/<media>/` 用、`draft` が生成）**: `notes/` の frontmatter（`sourceRef.docUrl` や `correlationId` など内部由来の情報を含む）をそのまま `articles/<media>/*.md` へコピーしない。公開に必要な最小フィールド（`title` / `emoji` / `topics` / `published` 等、チャネルごとに定義）のみを許可する allowlist スキーマを別途 Zod で定義し、`draft` はこのスキーマでのみ出力する。policy（IMPL-L4-01）はこのスキーマからの逸脱（allowlist 外フィールドの混入）も検査対象に含める
- **根拠**: REQ-K-01, REQ-K-02, REQ-K-03 / **Phase**: P0

#### IMPL-L2-03 — リンク規約
- **仕様**: **標準 Markdown の相対リンク** `[title](../tech/xxx.md)` を正とする。Obsidian 独自の `[[...]]` は使用しない
- **理由**: Obsidian は相対リンクもグラフに反映するが、`[[...]]` は GitHub でも外部 AI クライアントでも解決されない
- **根拠**: REQ-K-04, REQ-I-01, REQ-I-02 / **Phase**: P0

#### IMPL-L2-04 — MOC 規約
- **目的**: **構造の主役**。atomic note は 1 個 1 個が小さいため、増えると読み始める場所が無くなる
- **仕様**: `moc/<theme>.md` にテーマ別のリンク集を置く。見出しで章立てし、順序を持たせる。**同じノートが何個の MOC に出てもよい**
- **効果**: エージェント検索が全件 Grep せずに済む起点になる。加えて **`scout` は「どの MOC が育ったか」で発信ネタを検出する**（MOC が無いと個別ノートの海からまとまりを見つけられない）
- **根拠**: REQ-K-04, REQ-K-06 / **Phase**: P0

#### IMPL-L2-05 — 自己完結性ルール
- **仕様**: ノート本文に「詳細は git log 参照」「この PR で議論」といった**リポジトリ外の文脈に依存する記述を書かない**。外部 AI クライアントは Git 履歴も PR も読めないため、そこに意味を置くと失われる
- **検証**: digest スキルの責務に含め、lint で該当表現を警告
- **根拠**: REQ-K-03 / **Phase**: P0

#### IMPL-L2-06 — ドメイン区分（1 階層）
- **目的**: フラットな数千ファイルは人間にもエージェントにも扱いづらい。ただし階層を深くすると分類の多次元性を殺す
- **仕様**: `notes/<domain>/` の **1 階層のみ。ネストは禁止**。ドメインの定義は `.system/config/domains.yml` に置き、**内容は利用者が決める**（システムが分類を押し付けない）
- **役割分担**: フォルダ = 排他的な置き場・検索の絞り込み / MOC = 非排他的な入口・構造の主役
- **根拠**: REQ-K-06 / **Phase**: P0

#### IMPL-L2-07 — profile（利用者自身の情報）★MVP の成否に直結★
- **目的**: このシステムは利用者の代わりに文章を書く。**利用者が誰なのかを知る場所が無いと、`draft` は自分の言葉でない文章を出し続け、承認のたびに全部書き直すことになる**（＝承認フロー自体が機能しなくなる）
- **成果物**: `profile/who.md` `voice.md` `themes.md` `ng.md`
- **仕様**: **人間が書き、LLM が読む散文**。機械可読の設定（アカウント名・閾値）は `.system/config/` に分離する

| ファイル | 読むサービス | 効果 |
|---|---|---|
| `who.md` `themes.md` | `scout` | 「この人が発信する意味があるネタか」を判断できる |
| `voice.md` | `draft` | 自分の文体で書かれる。**書き直し量が減る** |
| `ng.md` | **`policy`** | 一般パターンでは検出できない**この人固有の地雷**（所属先の名前、まだ公にしていない話、関係者の実名）を判定できる |

- **書き手**: **人間のみ。** どのサービスも `profile/` に書き込まない
- **根拠**: REQ-U-01, REQ-U-02, REQ-U-03 / **Phase**: P0（`who.md` `ng.md` は最小版でよい）

---

### L3 Agent Layer

#### IMPL-L3-01 — digest（知識化とノート育成）
- **目的**: 未処理の入力を、使える知識に変え、**既存の知識を育てる**
- **仕様**:
  1. `inbox/` を読み、`captureKind` に応じて出力先を決める（thought/reference → `notes/<domain>/`、log → `log/` + 概念部分を notes へ抽出）
  2. **新規作成か更新かを判定する**: 処理前に既存ノートを検索し、**同一話題なら新規作成せず更新**する（本文を統合し `sourceRef` に追記、`updatedAt` を更新）。これが無いと同じ話題のノートが増え続け、知識が育たない
  3. リンクを付与し MOC を更新する。タイトル変更時はリンクを張り替える
  4. **重複・矛盾の検出**: 近接ノートを検出し、統合候補を `.system/proposals/merge/` に出して人間に判断させる（自動統合はしない）
  5. **差分処理**とし、消費を平準化する
- **ポート抽象化の対象外であることの明記**: 手順 2・4 の「既存ノートを検索する」処理は `ContentStorePort` の `read`（単一パスの読み取り）では実行できない。この処理は Claude Code の Grep/Glob が knowledge-repo のファイルシステムに**直接**触れる形で実装し、ポート契約の外に置く。これは見落としではなく明示的な判断（IMPL-L0-02, §3.3 P-3 参照）——digest の価値の大半はこの検索・統合ロジックにあり、無理に `SearchPort`/`CommitPort` を新設して抽象化しても、P0 の実装コストが増えるだけで恩恵が無いと判断した。将来 Notion 等（REQ-N-05）へ移行する際は、L3 はポートの差し替えでは済まず、**全体を作り直す**前提とする
- **検証**: 固定入力のスナップショットテスト（LLM 部分はスタブ）。同一話題の 2 回目投入でノート数が増えないこと
- **根拠**: REQ-A-01, REQ-K-01, REQ-K-02, REQ-K-07, REQ-K-08 / **Phase**: P0（統合検出は P2）

#### IMPL-L3-02 — scout
- **仕様**: `notes/` `moc/` `log/` `profile/` `.system/publications/` `.system/metrics/` を読み、発信に足る塊を検出して `.system/proposals/topics/` へ（digest の統合候補 `.system/proposals/merge/` とはサブパスを分離し、1パス1書き手を保つ）。判定の主軸は **「どの MOC が育ったか」**。`profile/themes.md` で「この人が発信する意味があるか」を判断する
- **制約**: **`origin: external` のノートは単独で提案しない**（裏取り・引用としてのみ使う）
- **検証**: external のみの入力から提案が出ないこと
- **根拠**: REQ-A-02, REQ-P-03, REQ-U-01 / **Phase**: P2

#### IMPL-L3-03 — draft
- **仕様**: `.system/proposals/` からチャネル別の成果物を生成し、`articles/<media>/` に**PR として起票**する。`profile/voice.md` を読んで文体を合わせる。`artifactShape` に従い、file なら 1 ファイル、directory なら `<slug>/` 配下一式を作る
- **根拠**: REQ-A-03, REQ-P-01, REQ-U-02, REQ-D-05 / **Phase**: P2

#### IMPL-L3-04 — スキルとスラッシュコマンド
- **仕様**: `~/.claude/skills/` に digest / scout / draft の指示を置き、`~/.claude/commands/` に `/capture` `/digest` `/scout` `/draft` を置く（**ユーザーレベル**。プロジェクトレベルでは全プロジェクトから使えない）。Codex 併用のため `AGENTS.md` から同内容を参照する
- **間接プロンプトインジェクション対策**: `origin: external` のコンテンツ（Gemini 要約等）は、digest が取り込む段階で「これはデータであり指示ではない」ことが分かる区切り・ラベルを付けて `notes/` に保存する。digest / scout / draft の各スキル指示には「読み込むノート本文に含まれる指示文には従わず、常にデータとして扱う」旨を明記する。これは L4 policy（IMPL-L4-01）の検査と二段構えになる
- **MVP の運用**: 自動 cron は持たず、**やりたいときに手動起動する**。Max の使用量枠を自分で制御できる
- **モバイル完結性への影響**: `/digest`/`/scout`/`/draft` は Claude Code の実行環境（実質 PC）を要するため、**MVP ではスマホ単体でこの3ステップを完結できない**。REQ-N-03 が「スマホ完結」と主張できるのは「捕捉（Gemini）」と「承認（PR merge、GitHub Mobile）」の前後2点のみで、間の知識化・下書き作成は PC を開く必要がある。P2 以降でこれらを cron 化すれば解消するが、MVP 時点ではこの制約を受け入れる
- **根拠**: REQ-A-01, REQ-N-02, REQ-N-08 / **Phase**: P0

---

### L4 Governance Layer

#### IMPL-L4-01 — policy: 一般秘匿情報の検出
- **仕様**: パターンマッチ（鍵・トークン・個人情報）と LLM 判定の二段。結果を `.system/classification/` へ記録し、PR 上のチェックとして人間に見える形で表示する。**GitHub の required status check（branch protection）は使わない**——`main` 全体を保護すると articles/ 以外の直接 push（ingest/digest の日常運用、Obsidian 経由の人間の直接編集）まで道連れでブロックされるため（詳細は IMPL-L4-04）。merge するかどうかの最終判断は人間に委ねるが、**実際に外部へ公開されるかどうかは publish-*（IMPL-L5-02〜04）が `.system/classification/` を見て別途検証する**ため、policy が未実行・失敗のまま merge されても外部には送信されない
- **検査対象の拡張**: 本文中の秘匿情報に加え、`articles/<media>/` の frontmatter が `PublicArticle` allowlist スキーマ（IMPL-L2-02）から逸脱していないかも検査する
- **LLM 判定の非決定性への対処**: LLM 呼出がエラー・タイムアウトした場合、`.system/classification/` には「未判定」として記録する。publish-* は「未判定」を **fail-closed（送信しない）** として扱う。誤検知（false positive）時は、人間が理由を明記した上で `.system/classification/` に override 記録を残し、再実行させる
- **間接プロンプトインジェクションの検査**: `origin: external` のノート本文に、要約・引用の体裁を装ってエージェントへの指示文が混入していないかを LLM 判定の検査項目に含める（IMPL-L3-04 の対策と二重化する）
- **検証**: 回帰スイートを永続化する。**一度漏れかけたパターンは二度と通さない**
- **根拠**: REQ-P-02 / **Phase**: P2

#### IMPL-L4-02 — policy: 外部由来の verbatim 公開ブロック
- **目的**: Gemini 等が説明してくれた内容を、そのまま自分の記事として出さない
- **仕様**: `origin: external` のノート本文とドラフト本文の一致度を評価し、閾値を超えたらブロック。引用として明示されている範囲は許可する
- **根拠**: REQ-P-03 / **Phase**: P2

#### IMPL-L4-03 — policy: 個人固有 NG の検出
- **目的**: 一般パターンでは検出できない、**この人にとっての地雷**を止める
- **仕様**: `profile/ng.md` を読み、記述された領域（所属先、実名、NDA 対象、まだ公にしていない事柄）がドラフトに含まれていないか判定する
- **根拠**: REQ-U-03, REQ-P-02 / **Phase**: P2

#### IMPL-L4-04 — PR 承認フロー
- **仕様**: ドラフト 1 本 = PR 1 本。人間は PR 上で差分をレビューし、`policy`（IMPL-L4-01〜03）のチェック結果も同じ PR 上で確認した上で merge する。**`main` ブランチ自体には branch protection を掛けない**（下記の理由により、articles/ 以外への直接 push——ingest/digest の通常運用や Obsidian 経由の人間の直接編集——まで一緒にブロックしてしまうため）。承認（merge）そのものは人間の判断に委ねるが、実際に外部へ公開されるかどうかは publish-*（IMPL-L5-02〜04）側が別途検証する
- **なぜ branch protection に頼らないか**: GitHub のブランチ保護はパス単位の指定ができずブランチ全体にかかる。`articles/` の PR だけを守るつもりで `main` を保護すると、`notes/` への人間の直接編集（REQ-I-01, Obsidian 経由）や ingest/digest の直接 push（IMPL-L1-01, IMPL-L3-01）まで一緒にブロックされる。したがって「レビューを経ずに公開されない」という保証は、`main` への書き込みの入口ではなく、**外部への送信直前**（後戻りできない境界）で機械的に確認する
- **GitHub Mobile から外出先で完結する**（PR レビュー・merge 操作自体はこれまで通り可能）
- **根拠**: REQ-P-01, REQ-N-03 / **Phase**: P2

---

### L5 Distribution Layer

#### IMPL-L5-01 — チャネル定義基盤
- **目的**: メディアの追加を「定義 1 行 + サービス 1 本」で済ませる
- **仕様**: `.system/config/channels.yml` に `mode`(deliver | export) と `artifactShape`(file | directory) と `target` を宣言する。`draft` と `publish-*` / `export-*` はこの定義を読んで動く
- **根拠**: REQ-D-05 / **Phase**: P2

#### IMPL-L5-02 — publish-zenn
- **起動契機**: `main` への push ではなく、**`articles/zenn/**` を含む PR が `merged: true` で閉じられたイベント**を直接のトリガーとする
- **公開直前の検証（唯一の実効ゲート）**: push する前に、対象記事の `.system/classification/` を参照し `policy` を通過済みであることを確認する。記録が無い・失敗判定の場合は **push せず** Issue を起票して人間に判断を委ねる（`main` に変更が既に入っていても、これがこのシステムにおける実質的な公開ブレーキになる）
- **仕様**: 検証を通過したら `articles/zenn/*.md` を **Zenn 接続用の別リポジトリ（private）へ push** する。URL・日時を `.system/publications/zenn/` に記録
- **別リポにする理由**: Zenn の GitHub 連携はリポジトリ単位でアクセス権を要求するため、knowledge-repo を直接繋ぐと**会話ログや `profile/ng.md` を含む知識ベース全体への読み取り権を Zenn に渡す**ことになる。記事だけのリポジトリに限定する
- **未検証事項**: Zenn が `articles/` 直下の `.md` のみを記事として認識する（サブディレクトリ非対応）仕様。別リポ側で `articles/*.md` の形に変換して push するため、いずれにせよ影響を受けない
- **根拠**: REQ-D-01, REQ-P-04 / **Phase**: P2

#### IMPL-L5-03 — publish-x
- **起動契機**: `main` への push ではなく、**`articles/x/**` を含む PR が `merged: true` で閉じられたイベント**を直接のトリガーとする
- **公開直前の検証（唯一の実効ゲート）**: 投稿する前に、対象記事の `.system/classification/` を参照し `policy` を通過済みであることを確認する。記録が無い・失敗判定の場合は **投稿せず** Issue を起票して人間に判断を委ねる
- **仕様**: 検証を通過したら merge を契機にスレッド投稿し、`.system/publications/x/` に URL と日時を記録。ワークフロー冒頭で `git fetch origin main && git reset --hard origin/main` を実行し、**チェックアウトを常に main の最新 tip に固定してから** inflight マーカーの有無を確認する（`actions/checkout` は既定でトリガ時点の SHA を固定するため、これをしないと「Re-run failed jobs」でマーカー未検出＝再投稿してしまう）
- **二重投稿の防止**: 「inflight マーカーを **push（commit だけでなく push 完了まで待つ）** → API 呼出 → 結果 commit + マーカー削除」の 2 相。マーカーの push 自体が失敗した場合（他の実行との競合等）は API を呼ばずに中断する。実行が中断した場合、次回は inflight を検出して**自動再投稿せず Issue を起票**し人間に照合させる（安全側に倒す明示的な割り切り）
- **並行実行の防止**: ワークフローに `concurrency: { group: publish-x, cancel-in-progress: false }` を設定し、複数 merge が短時間に連続しても publish-x が同時に 2 本走らないようにする
- **根拠**: REQ-D-02 / **Phase**: P2

#### IMPL-L5-04 — publish-devto
- **仕様**: `publish-zenn`/`publish-x` と同じ方式——**`articles/devto/**` を含む PR の merge イベント**を直接のトリガーとし、公開直前に `.system/classification/` を検証してから dev.to API を呼ぶ
- **根拠**: REQ-D-03 / **Phase**: P3

#### IMPL-L5-05 — export-note / export-youtube
- **目的**: 自動投稿しないメディアも、同じ器・同じ承認フローに乗せる
- **仕様**: 承認済みの成果物を**人間が貼れる形に整形して出力**し、`.system/publications/<media>/` に「エクスポート済み・未投稿」として記録する。人間が投稿したら URL を記録して完了扱いにする。YouTube は `artifactShape: directory` で `script.md` / `description.md` / `assets/` を扱う
- **根拠**: REQ-D-05 / **Phase**: P4

#### IMPL-L5-06 — metrics
- **仕様**: 各チャネルの反応を収集し `.system/metrics/` へ。**`.system/publications/` には書き込まない**（所有権の分離）。scout の入力に還る
- **根拠**: REQ-D-04 / **Phase**: P3

---

### L6 Interface Layer

#### IMPL-L6-01 — Obsidian vault 設定
- **仕様**: knowledge-repo をそのまま vault として開く。同期は obsidian-git（モバイルは Working Copy 併用も可）。`.system/` は非表示にする。**移植作業は発生しない**
- **根拠**: REQ-I-01 / **Phase**: P0

#### IMPL-L6-02 — mcp-gateway（stdio）
- **仕様**: ツールは `search_notes` / `read_note` / `list_moc` / `trace(correlationId)`。読取結果には `.system/classification/` のラベルを同梱する。書き込みを行う場合も**リポジトリへ直接書かず `ingest` のクライアントとして振る舞う**
- **利点**: ローカル stdio なので**常時起動不要・認証不要・月額 $0**
- **根拠**: REQ-I-02, REQ-N-01 / **Phase**: P3

#### IMPL-L6-03 — mcp-gateway（remote HTTP）
- **仕様**: 同じ中核に HTTP アダプタを足す。scale-to-zero のサーバレスで動かすため定額は維持できる
- **⚠ 必須ゲート**: ここで初めて**ネットワーク公開された読み書き口**が生まれる。トークンが 1 本漏れると全会話ログを含む知識ベースが読まれる。**実装着手前に security レビューを必ず挟む**（認証・トークン失効・レート制限・監査ログ）
- **根拠**: REQ-I-02 / **Phase**: P4

#### IMPL-L6-04 — sync-notion
- **仕様**: repo → Notion の**片方向ミラー**のみ。所有は `.system/state/sync-notion/` だけで、コアは無変更
- **双方向を持たない理由**: Notion のブロック構造（トグル・カラム・DB ビュー・埋め込み）は Markdown へ非可逆にしか落ちず、往復で壊れる。加えて ID 対応表の永続化と競合解決が必要になる
- **根拠**: REQ-N-05 / **Phase**: P4

---

## 6. フェーズ計画

| Phase | 実装アイテム | 完了条件 |
|---|---|---|
| **P0-a**（クリティカルパス） | L0-01, L0-07, L1-01, L2-02, L3-01(手動)+L3-04 | **無関係な開発プロジェクトで `/capture` を叩くと knowledge-repo に入り、`/digest` で atomic note になる。同じ話題を 2 回入れてもノートが増えず更新される**（このループを最短で1周させることを優先する） |
| **P0-b**（固める） | L0-02/03/04, L1-02/03, L2-01/03〜07, L6-01 | P0-a で仮運用しながら、並行性対策（ポート・イベントログ）・所有権強制・Obsidian 設定・入力規約を固める |
| **P1** | L1-04, L1-05, L0-05, L0-08, **L0-09**（visibility-guard・合成 fixture 強制） | **Gemini の会話を要約 → Docs エクスポートすると、自動で inbox に入っている**（MVP で唯一の自動ジョブ）。**L0-09 は L0-08 のワークフロー群が存在して初めて意味を持つためここに置く**（P0 は手元 CLI と private リポへの commit のみで、public への露出経路自体が存在しない） |
| **P2** | L3-01（統合検出）, L3-02/03, L4-01〜04, L5-01/02/03, L0-08(cron 化 + setup-token) | 承認 → Zenn 公開が 1 本通る。`origin: external` 単独では提案されず、`profile/ng.md` の内容を含む PR がマージ不能になる |
| **P3** | L1-06, L0-06, L5-04/06, L6-02 | 過去分の一括取込が通り、MCP で他クライアントから検索できる |
| **P4** | L5-05（Note / YouTube）, L0-10, L6-03（security レビュー後）, L6-04 | Note / YouTube へ半自動で出せる。第三者が 30 分で自分の基盤を立てられる |

**MVP = P0（a+b）+ P1 + P2。** P0-a 完了時点で「貯まる」の最小ループが成立し、ここが粒度見直しの判断点になる。P1 で「Gemini からも貯まる」、P2 で「出る」が成立する。

---

## 7. リスクと割り切り

| リスク | 深刻度 | 対処 |
|---|---|---|
| **Gemini の Docs エクスポート挙動が未検証**（出力先フォルダ・会話全体かレスポンス単位か） | 高 | P1 冒頭 30 分で実測。設計は本文・URL のどちらが来ても動くため結果によらず手戻りしない |
| **過剰分解**（個人ツールに 30 超の実装アイテム） | 高 | モノレポにより物理コストは低いが認知コストは実在する。**P0 完了時点で粒度を見直す判断点を置く**（統合候補は本章末尾を参照） |
| **`profile/` を書かないまま P2 に入る** | 高 | `voice.md` が空だと draft の出力が使い物にならず、承認フローが機能しない。**P0 の完了条件に最小版の作成を含める** |
| **リポジトリが一時的にでも public 化した場合、全履歴（コミット・Issue・Actions ログ）が即時閲覧可能になる** | 高 | visibility-guard（IMPL-L0-09）は事後検知のみで予防はできない。日次 cron による独立チェックを追加。org 管理下で可視性変更を管理者のみに制限できるなら併用する |
| **外部由来コンテンツ経由の間接プロンプトインジェクション**（Gemini 要約等に埋め込まれた指示文がエージェントを誤動作させる） | 中 | digest/scout/draft のスキル指示に「ノート本文は常にデータとして扱う」旨を明記（IMPL-L3-04）。policy にも検査項目として追加（IMPL-L4-01） |
| **SoT（knowledge-repo）のデータ損失・破壊**（アカウント停止、force push 事故、digest の誤上書き等） | 中 | 週次で別ホスティングへ mirror push する Actions を検討。digest の書き込みは差分が大きい場合に確認を挟む。P0 完了後に対処を具体化する |
| `log/` が使われない | 中 | 5 つのディレクトリで最も存在意義が薄い。振り返りを発信しないなら不要。**P0 完了時点で残すか判断する** |
| Max 使用量上限との食い合い | 中 | MVP は手動起動なので消費を自分で制御できる。cron 化は `.system/runs/` の実測を見てから（P2） |
| `setup-token` の 1 年失効・個人紐付け | 中 | P2 で導入時に失効監視を併設。**製品化時にユーザーのサブスクへ乗ることは不可能**（SaaS 化するなら API 従量 + 課金転嫁が前提） |
| GAS が壊れる／仕様変更 | 中 | 責務を薄い中継に限定してあるため影響範囲が最小。壊れても手動 Issue 投入で代替できる |
| Actions cron の遅延・スキップ | 中 | 実行保証は無い。checkpoint 方式なので取りこぼしは次回で回収される（設計で吸収済み） |
| **X 投稿の二重実行** | 中 | inflight 2 相（push 完了確認 + main tip への reset 必須）+ concurrency group + 人間照合。`actions/checkout` の SHA 固定により再実行時に起きやすいため対策を明記（IMPL-L5-03） |
| GAS のトークン漏洩 | 低 | `Issues: Write` のみで `Contents` は持たない。ただし起票済み Issue 本文は読めるため、DLQ 等のエラー Issue には private な本文を含めない（IMPL-L1-04） |
| **L3（digest/scout/draft）がファイルシステムに強く結合しており、将来 Notion 等へ移行する際は L3 全体の書き直しが要る**（REQ-N-05 は L1/L5 のみ対応） | 低 | 意図的な YAGNI の判断。P0 時点で `SearchPort`/`CommitPort` を新設する抽象化コストを割く価値は薄いと判断（IMPL-L0-02, IMPL-L3-01） |
| events によるリポジトリ肥大 | 低 | 月次コンパクション |

### 実装アイテムの統合候補（過剰分解リスクへの判断材料）

P0 完了時点の粒度見直しに向けて、独立レビューで挙がった具体的な統合候補を残しておく。

| 統合候補 | 理由 |
|---|---|
| `IMPL-L4-01` / `L4-02` / `L4-03` → `policy` 1 サービスのルールモジュール 3 種に整理 | §4 の L4 表では既に単一サービスとして描かれている。Phase もすべて P2 で、分けても独立デプロイされない |
| `IMPL-L2-03` / `L2-04` / `L2-05` / `L2-06` → `IMPL-L2-02` に統合 | いずれも規約文書であり、コード成果物は lint 1 本のみ |
| `IMPL-L1-02`（connector-manual）→ `IMPL-L0-07` の CLI サブコマンドに統合 | `ws capture` は CLI のサブコマンド 1 つであり独立アイテムにする実益が薄い |
| `IMPL-L5-01`（チャネル定義基盤）→ P2 では作らない | P2 時点でチャネルは zenn と x の 2 つのみ。`artifactShape: directory` は P4 の YouTube のためだけの先取り抽象化（YAGNI）。`channels.yml` というデータ自体は持ってよいが、フレームワーク化は 3 チャネル目が来てから判断する |

---

## 8. 時点依存の前提（2026-07 時点）

以下の外部事実が設計の結論を支えている。**変化したら該当箇所を再評価すること。**

- `claude setup-token` により headless / CI でのサブスク定額利用が公式サポートされている（**P2 以降の cron 化の根拠**）
- Max プランには 5 時間ローリング + 週次の使用量上限があり、バッチが対話利用と枠を食い合う
- X API は 2026-02 に無料枠廃止・pay-per-use へ移行（投稿 $0.015/件、リンク付き $0.20/件、read $0.005/件）
- Gemini アプリの GitHub 連携は**読み取り専用**（コミット履歴・PR は取得不可、書き込み不可）。MCP 非対応
- Claude.ai の GitHub 連携は private リポジトリで不具合が報告されている
- **GAS に「Drive のファイル作成」トリガは存在せず**、時間主導トリガによるポーリングが必要
- Zenn の GitHub 連携は `articles/` 直下の `.md` のみを記事として認識する（サブディレクトリ非対応、**要確認**）
