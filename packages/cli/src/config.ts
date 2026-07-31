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

/** 目印ファイル自体は保存先パスを持たない(自分自身を指すため冗長) */
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
