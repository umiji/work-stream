#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
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
  .action((opts: { kind: string; file?: string }) => {
    const config = loadConfig()
    const rawContent = opts.file ? readFileSync(opts.file, 'utf-8') : readFileSync(0, 'utf-8')
    const content = rawContent.trim()
    if (content.length === 0) {
      console.error('内容が空です。--file か標準入力で本文を渡してください。')
      process.exitCode = 1
      return
    }
    const item = buildCapturedItem({
      kind: opts.kind as 'thought' | 'reference' | 'log',
      content,
      cwd: process.cwd(),
      now: new Date(),
    })
    const result = ingest(item, config.knowledgeRepo)
    if (result.status === 'duplicate') {
      console.log(`既に取り込み済みです(重複はスキップ): ${result.path}`)
    } else {
      console.log(`取り込みました: ${result.path}`)
    }
  })

program.parseAsync(process.argv)
