import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

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
    writeFileSync(configPath, JSON.stringify({ knowledgeRepo: '/tmp/knowledge-repo' }))
    expect(() => loadConfig(configPath)).toThrow()
  })
})
