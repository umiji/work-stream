import { build } from 'esbuild'

// packages/cli の実行時依存(commander / zod / yaml / ulid / @work-stream/contracts)を
// すべて 1 ファイルに取り込む。プラグインの配布先では npm install が走らないため、
// 実行に必要なものが dist/ws.mjs 単独で完結している必要がある。
//
// packages/cli/src/index.ts は自前で `#!/usr/bin/env node` シバンを持つため、
// banner にシバンを重ねて指定すると出力の先頭にシバンが二重に並び構文エラーになる。
// esbuild はエントリーポイント自身のシバンをそのまま先頭行として保持するため、
// banner でシバンを追加する必要はない。
//
// 一方 commander は CommonJS 実装で、内部で `require('node:events')` のような
// Node 組み込みモジュールの require を行っている。esbuild で ESM 形式へバンドルすると、
// この内部 require が ESM スコープに存在しない `require` を参照してしまい、
// 実行時に "Dynamic require of ... is not supported" で落ちる（esbuild の既知の制約）。
// 対策として banner で `createRequire` を使い `require` を ESM 上に用意する。
await build({
  entryPoints: ['packages/cli/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/ws.mjs',
  banner: {
    js: "import { createRequire as __wsCreateRequire } from 'node:module'; const require = __wsCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
})
