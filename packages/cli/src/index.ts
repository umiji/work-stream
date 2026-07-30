#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { CaptureKindSchema, OriginSchema } from '@work-stream/contracts'
import { buildCapturedItem } from './capture-command.js'
import { loadConfig } from './config.js'
import { ingest } from './ingest.js'

const program = new Command()
program.name('ws').description('work-stream CLI(P0-a: capture のみ実装)')

program
  .command('capture')
  .description('気づき・検討・記録を knowledge-repo の inbox/ へ取り込む')
  .requiredOption('--kind <kind>', 'thought | reference | log')
  .option('--file <path>', '内容をファイルから読む(省略時は標準入力)')
  .option('--origin <origin>', 'self | external (省略時は self)', 'self')
  .action((opts: { kind: string; file?: string; origin: string }) => {
    try {
      const captureKindResult = CaptureKindSchema.safeParse(opts.kind)
      if (!captureKindResult.success) {
        console.error(`--kind の値が無効です: ${opts.kind} (thought, reference, log のいずれかを指定してください)`)
        process.exitCode = 1
        return
      }

      const originResult = OriginSchema.safeParse(opts.origin)
      if (!originResult.success) {
        console.error(`--origin の値が無効です: ${opts.origin} (self, external のいずれかを指定してください)`)
        process.exitCode = 1
        return
      }

      const config = loadConfig()
      const rawContent = opts.file ? readFileSync(opts.file, 'utf-8') : readFileSync(0, 'utf-8')
      const content = rawContent.trim()
      if (content.length === 0) {
        console.error('内容が空です。--file か標準入力で本文を渡してください。')
        process.exitCode = 1
        return
      }
      const item = buildCapturedItem({
        kind: captureKindResult.data,
        content,
        cwd: process.cwd(),
        now: new Date(),
        origin: originResult.data,
      })
      const result = ingest(item, config.knowledgeRepo)
      if (result.status === 'duplicate') {
        console.log(`既に取り込み済みです(重複はスキップ): ${result.path}`)
      } else {
        console.log(`取り込みました: ${result.path}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`エラーが発生しました: ${message}`)
      process.exitCode = 1
    }
  })

program.parseAsync(process.argv)
