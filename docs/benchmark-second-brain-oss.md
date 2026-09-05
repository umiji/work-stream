# セカンドブレイン系 OSS ベンチマーク（2026-09 時点）

> **調査の目的**: work-stream をセカンドブレイン（個人のナレッジ蓄積・活用基盤）に特化させ、メディア投稿は別プロジェクトへ切り出す方針転換にあたり、同種の OSS が何をどこまで解いているかを把握し、自分たちが作るべき差分を確定させる。
>
> **時点**: 2026-09-05。星数・活動状況は同日の GitHub 表示値。この分野は 2026-04 の Karpathy の投稿以降に急拡大しているため、**半年以上経ったら再調査すること**。

---

## 1. 結論（先に3行）

1. **「Markdown + Git + エージェントが整理する」という work-stream の設計は正しい。** 同じ結論に達した OSS が 2026 年に複数出ており、独自解ではなく主流化した設計になった
2. **ただし “整理する側（digest）” の作り込みで完全に負けている。** 競合は「元データを消さずに残す」「新規作成か更新かの判断規則」「整理結果を別のエージェントが検証する」といった仕組みを持つ。work-stream の digest は指示書 1 枚で、しかも取り込み済みデータを削除してしまう
3. **一方で “取り込む側（capture）” は work-stream が明確に優位。** 重複排除の仕組みと、どのプロジェクトからでも叩ける CLI を持つ実装は競合にほぼ無い。ここを軸に据えるのが最も勝ち筋が太い

---

## 2. 押さえるべき「型」: Karpathy の LLM Wiki パターン（2026-04）

現在この分野の設計はほぼこの型の派生である。**3 層構造**が肝:

| 層 | 役割 |
|---|---|
| `raw/` | 取り込んだ元データを**そのまま・消さずに**置く層 |
| `wiki/`（コンパイル層） | エージェントが raw を読んで書き起こした、1概念1ページの整理済みノート。ページ間はリンクでつなぐ |
| スキーマファイル | ページの書式・分類ルールをエージェントに教える定義 |

RAG（質問のたびに元文書を検索して回答を組み立てる方式）との違いは、**「検索するたびに再合成する」のではなく「1 回だけコンパイルして、以後は整理済みの層だけを読む」**点。知識が回を重ねるごとに濃くなる（compounding）ことを狙う。

work-stream の `inbox/` → `notes/` はこの型と同じ発想だが、**raw 層に相当するものが無い**（後述の【重大】1）。

---

## 3. 比較表

work-stream に近い順。星数は 2026-09-05 時点。

| プロジェクト | 星 | ライセンス | 位置づけ | work-stream との関係 |
|---|---|---|---|---|
| **[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian)** | 14.6k | MIT | Claude Code スキル。取り込み→出典付きノート化→検索まで。`inbox/` `.raw/`（改変不可の原本）`wiki/` 構成、BM25 のローカル検索 | **最も直接の競合。設計が酷似**しており、work-stream に無い機構を多数持つ |
| **[obsidian-second-brain](https://github.com/eugeniughelbur/obsidian-second-brain)** | 4.3k | MIT | Claude Code ほか 8 種の CLI エージェント向け永続メモリ。47 コマンド。夜間に自動整理する定期エージェント | 「ノートを新規追加せず既存を書き換える」思想と、事実の鮮度管理規則が参考になる |
| **[COG-second-brain](https://github.com/huytieu/COG-second-brain)** | 1.2k | MIT | Markdown + Git + スキル群のみで動く自己進化型。DB もサーバも無し | **アーキテクチャの思想が work-stream と同一**。検証ハーネスの作りが際立つ |
| **[basic-memory](https://github.com/basicmachines-co/basic-memory)** | 3.9k | AGPL-3.0 | MCP サーバとして LLM に永続記憶を提供。Markdown を実体とし、観察と関係で知識グラフを構成 | 「他の AI クライアントからも同じ知識に触れる」経路の作り方の参考 |
| **[khoj](https://github.com/khoj-ai/khoj)** | 37.1k | AGPL-3.0 | 自前ドキュメント + Web を横断する検索・対話アプリ。Obsidian/Emacs/モバイル対応 | 別カテゴリ（アプリ型・サーバ常駐）。work-stream が採らなかった路線の代表例 |
| **[karakeep](https://github.com/karakeep-app/karakeep)** | 28.8k | AGPL-3.0 | セルフホストのブックマーク基盤。ブラウザ拡張・モバイルアプリ・API から取り込み、LLM が自動タグ付け | **取り込み口の広さ**が圧倒的。work-stream の弱点が明確に見える比較対象 |
| **[cognee](https://github.com/topoteretes/cognee)** | 30.5k | Apache-2.0 | エージェント用メモリ基盤。グラフ DB + ベクタ DB を組んで知識グラフを構築 | 別カテゴリ（インフラ型）。MVP で RAG を作らない判断の妥当性を測る物差し |
| **[mem0](https://github.com/mem0ai/mem0)** | 64.7k | Apache-2.0 | エージェント用メモリ層。会話から記憶を抽出し、重複を実体連結で解消 | 「更新・削除をやめて追加のみにした」という設計転換（2026-04）が digest 設計の判断材料になる |
| **[silverbullet](https://github.com/silverbulletmd/silverbullet)** | 6.0k | MIT | Markdown + 独自クエリ言語のセルフホスト型ノートアプリ | 別カテゴリ（アプリ型）。閲覧・編集 UI が要るようになったときの選択肢 |

補足: Obsidian / Logseq / Anytype といったアプリ層は、work-stream の設計上「Markdown リポジトリを読み書きする View」に格下げ済みであり、競合ではなく併用先。この整理は現時点でも妥当。

---

## 4. work-stream が既に優位な点（捨ててはいけない資産）

1. **重複排除が仕組みとして入っている。** 同じ元ネタは何度投げても 1 回しか入らない（`sourceId` による冪等キー = 同じ元ネタなら同じ値になる合言葉）。調べた範囲で、この機構を明示的に持つ競合は無い。多くは「ファイルを同期するだけ」で、二重取り込みは人間が気づく前提
2. **取り込み 1 件ごとに git コミットが自動で残る。** いつ何が入ったかが履歴として追える。競合の多くは整理後にまとめてコミットするため、原本の到着時刻が失われる
3. **どのプロジェクトの作業中でも同じコマンドで投げ込める。** 保存先を 3 段階（環境変数 → 目印ファイル → 設定ファイル）で自動解決する仕組みにより、Obsidian の保管庫を開いていなくても捕捉できる。競合の多くは「保管庫を開いている前提」
4. **外部由来コンテンツを指示として実行しない、という安全規則が最初から digest 指示書に入っている。** 他人の文章に紛れた指示文でエージェントが誤作動する事故（間接プロンプトインジェクション）への備え。競合でここを明記しているものは少ない

---

## 5. 取り込むべき差分（重大度順）

### 【重大】1. 取り込んだ原本を削除している

現状の digest 指示書は、整理し終えた `inbox/*.md` を**削除する**手順になっている。しかし Karpathy 型・claude-obsidian・obsidian-second-brain はいずれも**原本を改変不可の層として永久保存**する。

- 影響: 整理の失敗・誤要約に気づいたとき、元の発言に戻れない。「整理し直す」という最も価値のある操作が不可能になる
- 対処案: `inbox/`（未処理キュー）と `raw/`（処理済み原本の保管庫）を分け、digest は削除ではなく `raw/` への移動にする。git 履歴で復元は可能だが、履歴を掘る運用は実質使われないため物理的に残すべき

### 【重大】2. 「新規作成か既存更新か」の判断が指示書 1 行に丸投げされている

digest 指示書は「Grep して同一話題なら更新」としか書いていない。同一話題の判定基準が無いため、実行のたびに結果がぶれる。

- 競合の解: claude-obsidian は主張ごとに出典と確信度を持つ台帳を作り、更新時に矛盾を表面化させる。obsidian-second-brain は**事実を「不変・日付つき・参照ポインタ」の 3 種に分類**し、古びる事実を本文に埋め込ませない規則を敷いている
- 対処案: 少なくとも「何が一致したら同一話題とみなすか」「矛盾する記述が既存ノートにあったらどうするか」を明文化する。mem0 が更新・削除をやめて追加のみに切り替えた（2026-04）事例もあり、**まず追加のみで運用し、統合は別工程に切る**という選択肢も検討に値する

### 【中】3. 整理結果を誰も検証していない

digest 指示書末尾の「検証」は、整理を行った本人（同じエージェント）が自己採点する形になっている。

- 競合の解: COG は**作業役と検証役を別エージェントに分離**し、検証役には作業役の報告文ではなく**生成されたファイルそのものだけ**を渡す。報告文を読ませると「うまくいきました」という自己申告に引きずられるため
- 対処案: 別プロジェクトへ切り出す配信側で「承認 = PR マージ」を採る設計だったのと同様に、digest にも機械的な事後チェック（例: 更新したはずのノートの更新日時が実際に変わっているか、リンク先が実在するか）をスクリプトとして持たせる

### 【中】4. 取り込み口がテキスト 1 経路しかない

karakeep はブラウザ拡張・iOS/Android アプリ・REST API・他サービスからの一括移行まで揃えている。work-stream は「Claude Code のコマンドから叩く」のみで、しかも実機未検証。

- 対処案: セカンドブレイン特化にするなら、取り込み口の広さは価値の中心になる。ただし全方位に広げるとメンテ不能になるため、**URL 1 本を投げる経路**（読んだ記事をその場で捕まえる）を次の 1 つに絞るのが妥当。なお音声メモを Telegram 経由で保管庫に入れる実装例もあり、モバイルからの捕捉は Claude のクラウドセッションに限らない

### 【軽微】5. 他の AI クライアントから読めない

basic-memory は MCP サーバ（AI クライアントに道具を提供する共通規格）として知識を公開しており、Claude 以外のクライアントからも同じ知識に触れられる。work-stream は Claude Code 専用。

- 対処案: 優先度は低い。ただし `ws` コマンドが既に読み書きの入口を持っているため、将来 MCP サーバ化する際のコストは小さい

---

## 6. 方針転換（メディア投稿の切り出し）への示唆

- **切り出しは妥当。** 調べた範囲で、セカンドブレインと配信を両方やっている OSS は無い。配信はチャネルごとの都合（API 課金・レート制限・審査）に振り回されるため、知識基盤と同居させると設計が濁る
- **切り出し後に残る `drafts/` `articles/` `published/` は、この repo からも消してよい。** ただし「ノートから記事の種を見つける」工程（設計書の scout に相当）は**セカンドブレイン側の価値**なので残す。境界線は「書く直前まで = こちら、書いて出す = あちら」
- **設計書の該当章（配信レイヤー L5・承認ポリシー L4）は削除せず、別プロジェクトへ移設したうえで参照を残す。** 「却下した選択肢とその理由を残す」という repo の流儀に沿えば、なぜ分離したかも記録に残すべき

---

## 7. 出典

- [Karpathy's LLM Wiki パターン解説（decodethefuture）](https://decodethefuture.org/en/llm-wiki-karpathy-pattern/) / [Data Science Dojo](https://datasciencedojo.com/blog/llm-wiki-tutorial/) / [Agentic AI Foundation](https://aaif.io/blog/karpathys-llm-wiki-as-agent-memory)
- [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian)
- [eugeniughelbur/obsidian-second-brain](https://github.com/eugeniughelbur/obsidian-second-brain)
- [huytieu/COG-second-brain](https://github.com/huytieu/COG-second-brain)
- [basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory)
- [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
- [karakeep-app/karakeep](https://github.com/karakeep-app/karakeep)
- [topoteretes/cognee](https://github.com/topoteretes/cognee)
- [mem0ai/mem0](https://github.com/mem0ai/mem0)
- [silverbulletmd/silverbullet](https://github.com/silverbulletmd/silverbullet)
- [charlie947/ai-second-brain](https://github.com/charlie947/ai-second-brain)
- [smixs/agent-second-brain（音声メモ取り込みの例）](https://github.com/smixs/agent-second-brain)
