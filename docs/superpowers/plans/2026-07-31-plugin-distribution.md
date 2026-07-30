# プラグイン配布と knowledge-repo の GitHub 化 実装計画

> **実装エージェント向け:** 必須サブスキル: `superpowers:subagent-driven-development`（推奨）または `superpowers:executing-plans` を使い、タスク単位で実装すること。各ステップはチェックボックス（`- [ ]`）形式。

**設計書:** [docs/superpowers/specs/2026-07-31-plugin-distribution-design.md](../specs/2026-07-31-plugin-distribution-design.md)

**ゴール:** work-stream 自身を Claude Code プラグインとして配布可能にし、PC のどのプロジェクトからでも、またスマホの Claude アプリからでも `/capture` で気づきを knowledge-repo に取り込めるようにする。

**アーキテクチャ:** work-stream リポジトリにプラグイン定義（`.claude-plugin/`）とコマンド・スキル（`commands/` `skills/`）を置き、`ws` コマンドを依存ごと 1 ファイルに固めて `dist/ws.mjs` として同梱する。プラグインの `bin/` は Claude Code により PATH へ自動追加されるため、npm のグローバルインストールを不要にする。knowledge-repo 側には目印ファイルとプラグイン宣言を置き、GitHub の private リポジトリとして push することでクラウドセッション（スマホ経由）から到達可能にする。

**技術スタック:** TypeScript (strict) / pnpm workspaces / vitest / zod ^3.23 / commander / ulid / yaml / esbuild（本計画で新規導入）

## グローバル制約

- **文書・コミットメッセージはすべて日本語で書く。** 英語へ切り替えない
- Node v22.14.0 / pnpm 10.19.0 を前提とする
- テストは `pnpm test`（vitest）、型チェックは `pnpm run typecheck`（`tsc -b packages/contracts packages/cli`）
- **既存の 31 件のテストを 1 件も壊さないこと。** 各タスクの最後に `pnpm test` 全体が green であることを確認する
- **このマシンの pnpm には `pnpm run <script> -- <args>` の引数転送が壊れる問題がある。** CLI を手動実行して確認する場合は `packages/cli/node_modules/.bin/tsx packages/cli/src/index.ts <args>` のようにフルパスで直接呼ぶこと。ラッパー越しの実行は避ける
- `dist/ws.mjs` は**ビルド成果物だが git にコミットする**（プラグインは配布時にビルドされないため）。`packages/cli/src/` または `packages/contracts/src/` を変更したタスクでは、必ず再ビルドして `dist/ws.mjs` も同じコミットに含める
- 既存の実装で `git commit` を行う箇所（`ingest()`）の挙動は本計画では変更しない

---

## ファイル構成

**新規作成**

| パス | 責務 |
|---|---|
| `.claude-plugin/plugin.json` | プラグインとしての自己申告（名前・版・説明） |
| `.claude-plugin/marketplace.json` | 配布元としての定義。どのプラグインをどこから配るか |
| `bin/ws` | POSIX 環境（Git Bash・クラウドの Ubuntu）用の起動スクリプト |
| `bin/ws.cmd` | Windows のコマンドプロンプト / PowerShell 用の起動スクリプト |
| `scripts/build.mjs` | `packages/cli/src/index.ts` を依存ごと `dist/ws.mjs` に固めるビルドスクリプト |
| `dist/ws.mjs` | 上記の生成物。プラグイン配布物の実体 |
| `commands/capture.md` | `templates/claude/commands/capture.md` からの移動先 |
| `commands/digest.md` | `templates/claude/commands/digest.md` からの移動先 |
| `skills/digest/SKILL.md` | `templates/claude/skills/digest/SKILL.md` からの移動先 |

**変更**

| パス | 変更内容 |
|---|---|
| `packages/cli/src/config.ts` | 保存先の解決順序を 4 段階に拡張する関数を追加 |
| `packages/cli/src/config.test.ts` | 新しい解決順序のテストを追加。`defaultDomain` を任意項目にしたことに伴う既存テストの修正 |
| `packages/cli/src/index.ts` | 設定の読み込みを新しい解決関数に差し替え |
| `package.json`（ルート） | `build` スクリプトと esbuild の devDependency を追加 |
| `README.md` | インストール手順・ビルド手順を追記 |
| `CLAUDE.md` | `templates/claude/` が無くなったことを反映 |

**削除**

| パス | 理由 |
|---|---|
| `templates/claude/` 配下すべて | `commands/` `skills/` へ移動したため役目を終える |

---

## タスク一覧

- Task 1: プラグインの骨格を作り、`bin/` が PATH に入ることを実測する
- Task 2: 保存先の解決順序を 4 段階に拡張する
- Task 3: `ws` を依存ごと 1 ファイルに固めるビルドを用意する
- Task 4: コマンドとスキルをプラグインの規約位置へ移動する
- Task 5: README とプロジェクト指示書を更新する
- Task 6: knowledge-repo を GitHub の private リポジトリにし、目印とプラグイン宣言を置く
- Task 7: E2E ① PC の無関係なフォルダから `/capture` が通ることを確認する
- Task 8: E2E ② スマホの Claude アプリから `/capture` が通ることを確認する

---

### Task 1: プラグインの骨格を作り、`bin/` が PATH に入ることを実測する

**なぜ最初にやるか:** 「プラグインの `bin/` ディレクトリが PATH へ自動追加される」という前提が、この設計全体の土台になっている。本環境の PATH に `superpowers/6.2.0/bin` 等が含まれていることは確認済みだが、**それらのプラグインは実際には `bin/` ディレクトリを持っていない**ため、「ディレクトリを実際に置いたら中身のコマンドが呼べる」ところまでは未確認である。ここが崩れると設計を変える必要があるので、ダミーのコマンドで最初に潰す。

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `bin/ws`
- Create: `bin/ws.cmd`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: プラグイン名 `work-stream`、マーケットプレイス名 `work-stream`。Task 6 の `.claude/settings.json` はこの 2 つの名前を `"work-stream@work-stream"` という形で参照する

- [ ] **Step 1: プラグイン定義を作る**

`.claude-plugin/plugin.json`:

```json
{
  "name": "work-stream",
  "description": "気づきを knowledge-repo に取り込む /capture と、inbox を atomic note に育てる /digest",
  "version": "0.1.0",
  "author": {
    "name": "umiji"
  },
  "homepage": "https://github.com/umiji/work-stream",
  "repository": "https://github.com/umiji/work-stream",
  "keywords": ["knowledge-base", "capture", "note-taking"]
}
```

- [ ] **Step 2: 配布元の定義を作る**

`.claude-plugin/marketplace.json`:

```json
{
  "name": "work-stream",
  "description": "work-stream のナレッジ捕捉プラグイン配布元",
  "owner": {
    "name": "umiji"
  },
  "plugins": [
    {
      "name": "work-stream",
      "description": "気づきを knowledge-repo に取り込む /capture と、inbox を atomic note に育てる /digest",
      "version": "0.1.0",
      "source": "./",
      "author": {
        "name": "umiji"
      }
    }
  ]
}
```

`"source": "./"` は「このマーケットプレイスのリポジトリ自身がプラグイン本体である」という意味。

- [ ] **Step 3: 起動スクリプトを暫定版で作る**

この時点では `dist/ws.mjs` がまだ存在しないため、PATH の検証だけを目的とした暫定版を置く。Task 3 で本物に差し替える。

`bin/ws`（改行コードは **LF**。CRLF だと Linux で `bad interpreter` エラーになる）:

```sh
#!/usr/bin/env sh
echo "ws placeholder: PATH resolution works"
```

`bin/ws.cmd`:

```bat
@echo off
echo ws placeholder: PATH resolution works
```

- [ ] **Step 4: 実行権限を git に登録する**

Windows のファイルシステムには実行ビットが無いため、git のインデックスに明示的に記録する。これをしないと、クラウドの Ubuntu 環境で `Permission denied` になる。

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json bin/ws bin/ws.cmd
git update-index --chmod=+x bin/ws
git ls-files -s bin/ws
```

期待する出力: モードが `100755` で始まること（`100644` なら実行権限が付いていない）。

- [ ] **Step 5: コミットする**

```bash
git commit -m "feat: プラグイン定義と起動スクリプトの骨格を追加"
```

- [ ] **Step 6: ローカルのプラグインとして読み込ませる（ユーザー操作）**

**このステップは実装エージェントでは実行できない。ユーザーに次を依頼し、結果を報告してもらう。**

Claude Code のセッションで以下を順に実行する。

```
/plugin marketplace add c:/Users/kaiki/Workspace/03_Dev/work-stream
/plugin install work-stream@work-stream
```

インストール後、Claude Code を再起動する（PATH の反映に再起動が要る）。

- [ ] **Step 7: PATH に入ったことを確認する**

再起動後のセッションで実行する。

```bash
which ws && ws
```

期待する結果:
- `which ws` が `.../plugins/cache/work-stream/work-stream/0.1.0/bin/ws` のようなパスを返す
- `ws` が `ws placeholder: PATH resolution works` と出力する

**この確認が失敗した場合は先へ進まず、報告して設計を見直すこと。** 想定される代替案は「`bin/` ではなく `/capture` コマンドの手順書からプラグインディレクトリ内の `dist/ws.mjs` を絶対パスで呼ぶ」（プラグインの設置パスを指す環境変数 `${CLAUDE_PLUGIN_ROOT}` が使えるかを併せて調べる）。

---

### Task 2: 保存先の解決順序を 4 段階に拡張する

**Files:**
- Modify: `packages/cli/src/config.ts`
- Modify: `packages/cli/src/config.test.ts`
- Modify: `packages/cli/src/index.ts:34`

**Interfaces:**
- Consumes: なし
- Produces:
  - `MARKER_FILENAME: string`（値は `'.work-stream.json'`）
  - `findRepoMarker(startDir: string): string | null`
  - `resolveConfig(options: { cwd: string; env: NodeJS.ProcessEnv; configPath?: string }): WorkStreamConfig`
  - `WorkStreamConfig` は `{ knowledgeRepo: string; defaultDomain?: string }`（`defaultDomain` を**必須から任意へ変更**する）
  - 既存の `loadConfig` と `defaultConfigPath` はそのまま残す

**`defaultDomain` を任意にする理由:** 現在このフィールドは必須として検証されているが、コードのどこからも読まれていない（P0-a 最終レビューの Minor 指摘）。環境変数だけで保存先を指定する経路では値の取得元が無いため、任意項目にするのが素直である。

- [ ] **Step 1: 失敗するテストを書く**

`packages/cli/src/config.test.ts` の末尾に、以下の `describe` ブロックを**追加**する（既存の `describe('loadConfig', ...)` は残す）。

```typescript
describe('resolveConfig', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ws-resolve-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('環境変数 WORK_STREAM_KNOWLEDGE_REPO を最優先する', () => {
    writeFileSync(join(dir, '.work-stream.json'), JSON.stringify({ defaultDomain: 'tech' }))
    const config = resolveConfig({
      cwd: dir,
      env: { WORK_STREAM_KNOWLEDGE_REPO: '/env/knowledge-repo' },
      configPath: join(dir, 'missing.json'),
    })
    expect(config.knowledgeRepo).toBe('/env/knowledge-repo')
  })

  it('カレントディレクトリに目印ファイルがあればそのディレクトリを保存先にする', () => {
    writeFileSync(join(dir, '.work-stream.json'), JSON.stringify({ defaultDomain: 'tech' }))
    const config = resolveConfig({
      cwd: dir,
      env: {},
      configPath: join(dir, 'missing.json'),
    })
    expect(config).toEqual({ knowledgeRepo: dir, defaultDomain: 'tech' })
  })

  it('親ディレクトリを辿って目印ファイルを見つける', () => {
    writeFileSync(join(dir, '.work-stream.json'), JSON.stringify({ defaultDomain: 'tech' }))
    const nested = join(dir, 'notes', 'work-stream')
    mkdirSync(nested, { recursive: true })
    const config = resolveConfig({
      cwd: nested,
      env: {},
      configPath: join(dir, 'missing.json'),
    })
    expect(config.knowledgeRepo).toBe(dir)
  })

  it('目印ファイルが無ければ設定ファイルを読む', () => {
    const configPath = join(dir, 'config.json')
    writeFileSync(configPath, JSON.stringify({ knowledgeRepo: '/from/config' }))
    const config = resolveConfig({ cwd: dir, env: {}, configPath })
    expect(config.knowledgeRepo).toBe('/from/config')
  })

  it('どの経路でも解決できなければ設定方法を案内するエラーを投げる', () => {
    expect(() =>
      resolveConfig({ cwd: dir, env: {}, configPath: join(dir, 'missing.json') }),
    ).toThrow(/WORK_STREAM_KNOWLEDGE_REPO/)
  })

  it('目印ファイルの中身が壊れていればエラーを投げる', () => {
    writeFileSync(join(dir, '.work-stream.json'), 'not json')
    expect(() =>
      resolveConfig({ cwd: dir, env: {}, configPath: join(dir, 'missing.json') }),
    ).toThrow()
  })
})
```

同ファイル冒頭の import を次のように差し替える。

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig, resolveConfig } from './config.js'
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
pnpm test
```

期待: `resolveConfig` が存在しないため、`config.test.ts` の新規 6 件が失敗する。既存 31 件は引き続き通る。

- [ ] **Step 3: 実装する**

`packages/cli/src/config.ts` を以下の内容で**全面的に置き換える**。

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/** knowledge-repo のルートに置く目印ファイルの名前 */
export const MARKER_FILENAME = '.work-stream.json'

export const WorkStreamConfigSchema = z.object({
  knowledgeRepo: z.string().min(1),
  defaultDomain: z.string().min(1).optional(),
})
export type WorkStreamConfig = z.infer<typeof WorkStreamConfigSchema>

/** 目印ファイル自体は保存先パスを持たない（自分自身を指すため冗長） */
export const RepoMarkerSchema = z.object({
  defaultDomain: z.string().min(1).optional(),
})

export function defaultConfigPath(): string {
  return join(homedir(), '.config', 'work-stream', 'config.json')
}

export function loadConfig(configPath: string = defaultConfigPath()): WorkStreamConfig {
  const raw = readFileSync(configPath, 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  return WorkStreamConfigSchema.parse(parsed)
}

/** startDir から親方向へ辿り、目印ファイルを持つ最初のディレクトリを返す */
export function findRepoMarker(startDir: string): string | null {
  let current = startDir
  for (;;) {
    if (existsSync(join(current, MARKER_FILENAME))) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

export interface ResolveConfigOptions {
  cwd: string
  env: NodeJS.ProcessEnv
  configPath?: string
}

/**
 * 保存先(knowledge-repo)を次の順で解決する。
 * 1. 環境変数 WORK_STREAM_KNOWLEDGE_REPO
 * 2. カレントディレクトリから親方向へ辿って見つかる目印ファイルのあるディレクトリ
 *    (クラウドセッションでは knowledge-repo 自体を開いているためここで解決する)
 * 3. 設定ファイル(PC で他プロジェクトにいるとき)
 * 4. いずれも該当しなければ、設定方法を案内するエラー
 */
export function resolveConfig(options: ResolveConfigOptions): WorkStreamConfig {
  const fromEnv = options.env.WORK_STREAM_KNOWLEDGE_REPO
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return { knowledgeRepo: fromEnv }
  }

  const markerDir = findRepoMarker(options.cwd)
  if (markerDir !== null) {
    const raw = readFileSync(join(markerDir, MARKER_FILENAME), 'utf-8')
    const marker = RepoMarkerSchema.parse(JSON.parse(raw))
    return { knowledgeRepo: markerDir, defaultDomain: marker.defaultDomain }
  }

  const configPath = options.configPath ?? defaultConfigPath()
  if (existsSync(configPath)) {
    return loadConfig(configPath)
  }

  throw new Error(
    'knowledge-repo の場所を特定できません。次のいずれかを設定してください:\n' +
      '  1. 環境変数 WORK_STREAM_KNOWLEDGE_REPO に knowledge-repo のパスを設定する\n' +
      `  2. knowledge-repo のルートに ${MARKER_FILENAME} を置き、その配下で実行する\n` +
      `  3. ${configPath} に {"knowledgeRepo": "<パス>"} を書く`,
  )
}
```

- [ ] **Step 4: 既存テストの想定を更新する**

`defaultDomain` を任意にしたため、`config.test.ts` の既存テスト「throws when required fields are missing」が成立しなくなる。次のように**必須項目である `knowledgeRepo` の欠落**を検証する形へ書き換える。

```typescript
  it('throws when required fields are missing', () => {
    writeFileSync(configPath, JSON.stringify({ defaultDomain: 'tech' }))
    expect(() => loadConfig(configPath)).toThrow()
  })
```

- [ ] **Step 5: 呼び出し側を差し替える**

`packages/cli/src/index.ts` の import 文を変更する。

```typescript
import { resolveConfig } from './config.js'
```

同ファイル 34 行目付近の設定読み込みを差し替える。

```typescript
      const config = resolveConfig({ cwd: process.cwd(), env: process.env })
```

- [ ] **Step 6: テストと型チェックが通ることを確認する**

```bash
pnpm test
pnpm run typecheck
```

期待: 全テスト PASS（既存 31 件 + 新規 6 件 = 37 件）。型チェックはエラーなし。

- [ ] **Step 7: コミットする**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts packages/cli/src/index.ts
git commit -m "feat: 保存先の解決順序を環境変数・目印ファイル・設定ファイルの3段階に拡張"
```

---

### Task 3: `ws` を依存ごと 1 ファイルに固めるビルドを用意する

**Files:**
- Create: `scripts/build.mjs`
- Create: `dist/ws.mjs`（ビルド生成物。コミットする）
- Modify: `package.json`（ルート）
- Modify: `bin/ws`（Task 1 の暫定版を本物に差し替え）
- Modify: `bin/ws.cmd`（同上）

**Interfaces:**
- Consumes: Task 2 の `resolveConfig`（`packages/cli/src/index.ts` 経由で取り込まれる）
- Produces: `dist/ws.mjs`（`node dist/ws.mjs capture --kind thought --file <path>` の形で起動できる単一ファイル）

- [ ] **Step 1: esbuild を開発依存に追加する**

```bash
pnpm add -D -w esbuild
```

`-w` はワークスペースのルートに追加する指定。

- [ ] **Step 2: ビルドスクリプトを書く**

`scripts/build.mjs`:

```javascript
import { build } from 'esbuild'

// packages/cli の実行時依存(commander / zod / yaml / ulid / @work-stream/contracts)を
// すべて 1 ファイルに取り込む。プラグインの配布先では npm install が走らないため、
// 実行に必要なものが dist/ws.mjs 単独で完結している必要がある。
await build({
  entryPoints: ['packages/cli/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/ws.mjs',
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'info',
})
```

`target: 'node20'` はクラウドセッションが Node 20 以上を提供することに合わせた下限。

- [ ] **Step 3: ビルドコマンドを登録する**

ルートの `package.json` の `scripts` に `build` を追加する。変更後は次のようになる。

```json
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b packages/contracts packages/cli"
  },
```

- [ ] **Step 4: ビルドを実行する**

```bash
pnpm run build
```

期待: `dist/ws.mjs` が生成される。esbuild が警告を出す場合は内容を確認すること（`node:` 標準モジュールが外部化される旨の情報ログは正常）。

- [ ] **Step 5: 固めたファイルが単独で起動することを確認する**

```bash
node dist/ws.mjs --help
node dist/ws.mjs capture --help
```

期待: どちらも commander のヘルプが表示され、終了コード 0 で終わること。`Cannot find module` 系のエラーが出た場合は、その依存が bundle から漏れているのでビルド設定を見直す。

- [ ] **Step 6: 起動スクリプトを本物に差し替える**

`bin/ws`（改行コードは **LF**）:

```sh
#!/usr/bin/env sh
exec node "$(dirname -- "$0")/../dist/ws.mjs" "$@"
```

`bin/ws.cmd`:

```bat
@echo off
node "%~dp0..\dist\ws.mjs" %*
```

- [ ] **Step 7: 起動スクリプト経由で動くことを確認する**

```bash
./bin/ws capture --help
```

期待: Step 5 と同じヘルプが表示されること。

- [ ] **Step 8: 生成物を除外していないことを確認する**

`.gitignore` に `dist` が含まれていると、配布物がコミットされずプラグインが動かない。

```bash
git check-ignore -v dist/ws.mjs
```

期待: 何も出力されず終了コードが 1（＝無視されていない）。何か出力された場合は `.gitignore` を修正する（`dist/` の除外を外すか、`!dist/ws.mjs` で打ち消す）。

- [ ] **Step 9: 実行権限を確認してコミットする**

```bash
git add package.json pnpm-lock.yaml scripts/build.mjs dist/ws.mjs bin/ws bin/ws.cmd
git update-index --chmod=+x bin/ws
git ls-files -s bin/ws
git commit -m "feat: wsを依存ごと単一ファイルに固めるビルドを追加"
```

`git ls-files -s bin/ws` のモードが `100755` であることを確認してからコミットすること。

---

### Task 4: コマンドとスキルをプラグインの規約位置へ移動する

**Files:**
- Create: `commands/capture.md`（`templates/claude/commands/capture.md` の内容をそのまま）
- Create: `commands/digest.md`（`templates/claude/commands/digest.md` の内容をそのまま）
- Create: `skills/digest/SKILL.md`（`templates/claude/skills/digest/SKILL.md` の内容をそのまま）
- Delete: `templates/` 配下すべて

**Interfaces:**
- Consumes: Task 1 のプラグイン定義（`commands/` `skills/` はプラグインの規約位置として読まれる）
- Produces: `/capture` `/digest` スラッシュコマンドと digest スキル

- [ ] **Step 1: git の履歴を保ったまま移動する**

内容は変更せず、位置だけを変える。`git mv` を使うと履歴が追跡される。

```bash
mkdir -p commands skills/digest
git mv templates/claude/commands/capture.md commands/capture.md
git mv templates/claude/commands/digest.md commands/digest.md
git mv templates/claude/skills/digest/SKILL.md skills/digest/SKILL.md
```

- [ ] **Step 2: 空になったディレクトリを片付ける**

```bash
rm -rf templates
git status --short
```

期待: `templates/` 配下の削除と `commands/` `skills/` への追加のみが差分として出ること。

- [ ] **Step 3: 移動後の内容が変わっていないことを確認する**

```bash
git diff --cached -M --stat
```

期待: リネームとして検出され（`R100` のような表示）、内容の変更が 0 行であること。

- [ ] **Step 4: コミットする**

```bash
git commit -m "refactor: コマンドとスキルをプラグインの規約位置へ移動"
```

- [ ] **Step 5: 移動したコマンドが読み込まれることを確認する（ユーザー操作）**

**このステップは実装エージェントでは実行できない。ユーザーに次を依頼する。**

Claude Code を再起動し、`/capture` と `/digest` がスラッシュコマンドの候補に現れることを確認する。現れない場合は `/plugin` でプラグインの状態を確認し、報告する。

---

### Task 5: README とプロジェクト指示書を更新する

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1〜4 の成果（プラグイン名・ビルドコマンド・ディレクトリ構成）
- Produces: なし（文書のみ）

- [ ] **Step 1: README に導入手順とビルド手順を追記する**

`README.md` の末尾に次のセクションを追加する。既存の記述は消さない。

````markdown
## 導入

Claude Code に本リポジトリをプラグインとして追加する。

```
/plugin marketplace add umiji/work-stream
/plugin install work-stream@work-stream
```

インストール後に Claude Code を再起動すると、`/capture` `/digest` コマンドと `ws` コマンドがすべてのプロジェクトで使えるようになる。

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
````

- [ ] **Step 2: プロジェクト指示書の記述を実態に合わせる**

`CLAUDE.md` の冒頭「リポジトリの性質」章にある次の記述を書き換える。

変更前:

```
`templates/claude/`（Claude Code 用の `/capture` `/digest` コマンドと digest skill のテンプレート）も含まれる。
```

変更後:

```
`commands/`・`skills/`（Claude Code プラグインとして配布される `/capture` `/digest` コマンドと digest skill）も含まれる。
```

同章の次の箇条書きは、プラグイン化により**事実として古くなる**ため差し替える。

変更前:

```
- `templates/claude/` 配下は**テンプレートであり、`~/.claude/` へはまだデプロイされていない**（実配置は P0-b 以降）。ユーザーの Claude Code 環境の `/capture` `/digest` はこのテンプレートを直接使っているわけではないので、「実装が存在する」と「ユーザー環境で使える」を混同しないこと
```

変更後:

```
- `commands/`・`skills/` は **Claude Code プラグインとして配布される実体**であり、`/plugin install work-stream@work-stream` を実行済みの環境では実際に `/capture` `/digest` として呼び出せる（2026-07-31 時点）。`packages/cli/src/` を変更した場合は `pnpm run build` で `dist/ws.mjs` を再生成しないと、配布物側に反映されない点に注意する
```

さらに「まだ存在しないもの」章の次の記述も差し替える。

変更前:

```
一方、`capture/`・`publish/` に相当するもの（`packages/cli` の `ws capture` コマンド）と、`.claude/skills/`・`.github/workflows/` の一部に相当するもの（`templates/claude/commands/*.md`、`templates/claude/skills/digest/SKILL.md`）は、**この `work-stream` リポジトリの中にはテンプレート／実装として存在する**。ただし後者はあくまでテンプレートであり、`~/.claude/` へ配置されるまでは実際の Claude Code セッションからは呼び出せない。「`work-stream` 内にテンプレートがある」ことと「`knowledge-repo` の `inbox/`・`notes/` 構造が実在する」ことを混同しないこと。
```

変更後:

```
一方、`capture/`・`publish/` に相当するもの（`packages/cli` の `ws capture` コマンド）と、`.claude/skills/` の一部に相当するもの（`commands/*.md`、`skills/digest/SKILL.md`）は、**この `work-stream` リポジトリの中に実装として存在し、プラグイン経由で実際に呼び出せる**。「`work-stream` 内に実装がある」ことと「`knowledge-repo` の `inbox/`・`notes/` 構造が実在する」ことは依然として別の話なので混同しないこと。
```

- [ ] **Step 3: コミットする**

```bash
git add README.md CLAUDE.md
git commit -m "docs: プラグイン導入手順とビルド手順を追記し実装状況の記述を更新"
```

---

### Task 6: knowledge-repo を GitHub の private リポジトリにし、目印とプラグイン宣言を置く

**このタスクは `c:\Users\kaiki\Workspace\03_Dev\knowledge-repo` で作業する。work-stream リポジトリではない。**

**Files（すべて knowledge-repo 側）:**
- Create: `.work-stream.json`
- Create: `.claude/settings.json`

**Interfaces:**
- Consumes: Task 1 のプラグイン名とマーケットプレイス名（`work-stream` / `work-stream`）、Task 2 の目印ファイル名（`.work-stream.json`）、Task 3 の `dist/ws.mjs`
- Produces: クラウドセッションから到達可能な private リポジトリ

- [ ] **Step 1: 目印ファイルを置く**

`c:\Users\kaiki\Workspace\03_Dev\knowledge-repo\.work-stream.json`:

```json
{
  "defaultDomain": "tech"
}
```

- [ ] **Step 2: プラグイン宣言を置く**

`c:\Users\kaiki\Workspace\03_Dev\knowledge-repo\.claude\settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "work-stream": {
      "source": {
        "source": "github",
        "repo": "umiji/work-stream"
      }
    }
  },
  "enabledPlugins": {
    "work-stream@work-stream": true
  }
}
```

このキーの形式は、本環境の `~/.claude/settings.json` に実在する 3 プラグイン（`ecc@ecc` / `dev-dup-protect@co-dev-tools` / `superpowers@superpowers-dev`）の記述から確認したもの。

- [ ] **Step 3: 先にコミットする**

次の Step 4 で `git reset --hard` を使うため、ここで確実にコミットしておく。順序を入れ替えないこと。

```bash
cd c:/Users/kaiki/Workspace/03_Dev/knowledge-repo
git add .work-stream.json .claude/settings.json
git commit -m "chore: work-streamプラグインの宣言と保存先の目印を追加"
git log --oneline -1
```

- [ ] **Step 4: 目印ファイルが解決に使われることを確認する**

knowledge-repo をカレントディレクトリにして、設定ファイルではなく目印ファイル経由で保存先が解決されるかを確かめる。

```bash
cd c:/Users/kaiki/Workspace/03_Dev/knowledge-repo
node c:/Users/kaiki/Workspace/03_Dev/work-stream/dist/ws.mjs capture --kind thought --file .work-stream.json
```

期待: `取り込みました: .../knowledge-repo/inbox/<ID>.md` と表示されること。

- [ ] **Step 5: 試験用の取り込みを取り消す**

Step 4 で作られた取り込みコミット 1 件だけを取り消す。

```bash
cd c:/Users/kaiki/Workspace/03_Dev/knowledge-repo
git log --oneline -3
```

**取り消す対象が `feat(ingest): capture thought ...` であることを目視で確認してから**次を実行する。作業ツリーに未コミットの変更が無いことも併せて確認する（`git status --short` が空であること）。

```bash
git reset --hard HEAD~1
git log --oneline -1
```

期待: Step 3 のコミット（`chore: work-streamプラグインの宣言と保存先の目印を追加`）が HEAD になっていること。

- [ ] **Step 6: GitHub に private リポジトリとして作成し push する（ユーザー確認が必要）**

**外部サービスへの公開を伴う操作なので、実行前にユーザーへ確認を取ること。**

```bash
cd c:/Users/kaiki/Workspace/03_Dev/knowledge-repo
gh repo create umiji/knowledge-repo --private --source . --remote origin --push
```

- [ ] **Step 7: private であることを確認する**

```bash
gh repo view umiji/knowledge-repo --json visibility,name
```

期待: `"visibility": "PRIVATE"` であること。**`PUBLIC` だった場合はただちに `gh repo edit umiji/knowledge-repo --visibility private` で修正し、ユーザーに報告すること。** このリポジトリには個人の思考の記録が入るため、公開状態は事故に直結する。

---

### Task 7: E2E ① PC の無関係なフォルダから `/capture` が通ることを確認する

**Files:** なし（検証のみ）

**Interfaces:**
- Consumes: Task 1〜6 のすべて
- Produces: なし

- [ ] **Step 1: 検証用の無関係なフォルダを用意する**

work-stream でも knowledge-repo でもない場所で実行することが検証の要点。前回のセッションでは `packages/cli` から実行してしまい、取り込み元プロジェクト名が `cli` になる失敗をしている。

```bash
mkdir -p "C:/Users/kaiki/AppData/Local/Temp/claude/e2e-unrelated-project"
cd "C:/Users/kaiki/AppData/Local/Temp/claude/e2e-unrelated-project"
git init
pwd
```

- [ ] **Step 2: PATH 経由で `ws` が呼べることを確認する**

```bash
which ws
ws capture --help
```

期待: プラグインのキャッシュ配下のパスが返り、ヘルプが表示されること。

- [ ] **Step 3: 実際に取り込む**

```bash
cd "C:/Users/kaiki/AppData/Local/Temp/claude/e2e-unrelated-project"
printf 'プラグイン配布のE2E検証。無関係なプロジェクトから捕捉できるかを確認している。' > e2e-note.txt
ws capture --kind thought --file e2e-note.txt
```

期待: `取り込みました: .../knowledge-repo/inbox/<ID>.md`

- [ ] **Step 4: 取り込まれた内容を確認する**

```bash
cd c:/Users/kaiki/Workspace/03_Dev/knowledge-repo
git log --oneline -1
ls inbox/
cat "inbox/$(ls -t inbox/ | head -1)"
```

確認する点:
- 冒頭のメタ情報（frontmatter）の `sourceRef` に含まれるプロジェクト名が `e2e-unrelated-project` であること（`cli` や `work-stream` になっていたら、実行場所が誤っている）
- `captureKind` が `thought`、`origin` が `self` であること
- 保存先が設定ファイル経由（順位 3）で解決されていること。knowledge-repo の外から実行しているため目印ファイルは見つからないのが正しい

- [ ] **Step 5: 重複が弾かれることを確認する**

同じ内容をもう一度取り込む。

```bash
cd "C:/Users/kaiki/AppData/Local/Temp/claude/e2e-unrelated-project"
ws capture --kind thought --file e2e-note.txt
```

期待: `既に取り込み済みです(重複はスキップ)` と表示され、`inbox/` のファイル数が増えないこと。

- [ ] **Step 6: 結果を報告する**

Step 4 で確認した frontmatter の内容を、実際の出力として報告する。「動きました」だけでは不十分。

---

### Task 8: E2E ② スマホの Claude アプリから `/capture` が通ることを確認する

**Files:** なし（検証のみ）

**Interfaces:**
- Consumes: Task 1〜7 のすべて
- Produces: なし

**このタスクは実装エージェントでは実行できない。ユーザーの手元のスマホ操作が必要。手順を提示し、結果を報告してもらう。**

- [ ] **Step 1: work-stream を GitHub へ push する**

クラウドセッションはマーケットプレイスを GitHub から取得するため、Task 1〜5 の成果が push 済みである必要がある。

```bash
cd c:/Users/kaiki/Workspace/03_Dev/work-stream
git push origin main
```

- [ ] **Step 2: クラウドセッションを開く（ユーザー操作）**

PC のブラウザまたはスマホの Claude アプリから claude.ai/code を開き、`umiji/knowledge-repo` を対象にした新しいセッションを開始する。

**まず PC のブラウザで確認することを勧める。** 失敗した場合の原因（プラグインが入らない／`ws` が見つからない／git の権限）が読み取りやすいため。PC で通ってからスマホで再確認する。

- [ ] **Step 3: プラグインが自動で入ったことを確認する（ユーザー操作）**

クラウドセッションで次を依頼する。

```
which ws を実行して結果を教えて
```

期待: プラグインのキャッシュ配下のパスが返ること。見つからない場合は、プラグインの自動インストールが働いていない。`.claude/settings.json` の内容と、セッションのネットワーク設定（Trusted であること）を確認する。

- [ ] **Step 4: 取り込みを実行する（ユーザー操作）**

クラウドセッションで次を実行する。

```
/capture スマホのClaudeアプリからクラウドセッション経由で捕捉できるかのE2E検証
```

期待: `取り込みました: .../inbox/<ID>.md`

- [ ] **Step 5: knowledge-repo に反映されたことを確認する（ユーザー操作）**

クラウドセッションで次を依頼する。

```
git log --oneline -3 と git status を実行して結果を教えて
```

確認する点:
- 取り込みのコミットが作られていること
- そのコミットが GitHub の `main` に push されているか、それとも作業ブランチに留まっているか

**ここが設計書の未検証事項 1 に対応する。** クラウドセッションの GitHub プロキシは「push はセッションの現在の作業ブランチに対してのみ動作する」とされており、`main` へ直接反映できるかが未確認である。

- `main` へ push できた場合: そのまま完了
- push できなかった場合: **失敗ではなく想定内の分岐**として扱う。`commands/capture.md` に「クラウドセッションではブランチを作って PR を出す」旨を追記する対応を、別タスクとして起こす。これは設計書の「承認 = PR merge」という方針とも整合する

- [ ] **Step 6: PC から取り込み結果を取得して確認する**

```bash
cd c:/Users/kaiki/Workspace/03_Dev/knowledge-repo
git fetch origin
git log --oneline origin/main -3
```

期待: Step 4 で作られた取り込みのコミットが `origin/main` に見えること（Step 5 で main へ push できた場合）。

- [ ] **Step 7: `/digest` が目印ファイルの影響を受けないことを確認する（ユーザー操作）**

設計書の未検証事項 3 に対応する。knowledge-repo のルートに `.work-stream.json` を追加したことで、`inbox/` を atomic note に育てる `/digest` の挙動が変わらないかを確かめる。

クラウドセッション（または PC で knowledge-repo を開いたセッション）で次を実行する。

```
/digest
```

確認する点:
- Step 4 で取り込んだ内容が `notes/<ドメイン>/` のノートになる、または既存ノートへ統合されること
- **`.work-stream.json` や `.claude/settings.json` が digest の処理対象として拾われていないこと**（これらは設定ファイルであってナレッジではないため、ノート化されてはいけない）

拾われていた場合は、`skills/digest/SKILL.md` に「処理対象は `inbox/` 配下のみ」である旨を明記する対応を別タスクとして起こす。

- [ ] **Step 8: 結果を報告する**

Step 3〜7 の各出力を実際の内容として報告する。特に Step 5 の分岐（`main` へ直接 push できたかどうか）は、以降の設計判断に直結するため明確に記録する。

---

## 完了条件

- [ ] `pnpm test` が全件 PASS（既存 31 件 + 新規 6 件 = 37 件）
- [ ] `pnpm run typecheck` がエラーなし
- [ ] PC の無関係なフォルダから `ws capture` が knowledge-repo に届く（Task 7）
- [ ] スマホまたはブラウザのクラウドセッションから `/capture` が knowledge-repo に届く（Task 8）
- [ ] `umiji/knowledge-repo` が GitHub 上で private であることを確認済み
- [ ] 設計書の未検証事項 1（クラウドから main へ push できるか）に結論が出ている
- [ ] 設計書の未検証事項 3（目印ファイルが `/digest` に影響しないか）に結論が出ている
