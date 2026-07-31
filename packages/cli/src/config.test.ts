import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig, resolveConfig } from './config.js'

describe('loadConfig', () => {
  let dir: string
  let configPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ws-config-'))
    configPath = join(dir, 'config.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads a valid config file', () => {
    writeFileSync(
      configPath,
      JSON.stringify({ knowledgeRepo: '/tmp/knowledge-repo', defaultDomain: 'tech' }),
    )
    const config = loadConfig(configPath)
    expect(config).toEqual({ knowledgeRepo: '/tmp/knowledge-repo', defaultDomain: 'tech' })
  })

  it('throws when the file does not exist', () => {
    expect(() => loadConfig(join(dir, 'missing.json'))).toThrow()
  })

  it('throws when required fields are missing', () => {
    writeFileSync(configPath, JSON.stringify({ defaultDomain: 'tech' }))
    expect(() => loadConfig(configPath)).toThrow()
  })
})

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
