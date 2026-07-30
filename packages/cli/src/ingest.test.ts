import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CapturedItem } from '@work-stream/contracts'
import { ingest } from './ingest.js'

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' })
}

function baseItem(overrides: Partial<CapturedItem> = {}): Omit<CapturedItem, 'correlationId'> {
  return {
    sourceType: 'manual',
    sourceId: 'manual#abc123',
    captureKind: 'thought',
    origin: 'self',
    capturedAt: '2026-07-28T09:00:00.000Z',
    sourceRef: { project: 'my-app' },
    tags: [],
    content: '検討の結論をここに書く',
    ...overrides,
  }
}

describe('ingest', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'ws-ingest-'))
    git(repo, 'init')
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'user.name', 'Test')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('writes a new CapturedItem into inbox/ and commits it', () => {
    const result = ingest(baseItem(), repo)
    expect(result.status).toBe('ingested')
    const inboxFiles = readdirSync(join(repo, 'inbox'))
    expect(inboxFiles).toHaveLength(1)
    const log = git(repo, 'log', '--oneline')
    expect(log.trim().split('\n')).toHaveLength(1)
  })

  it('does not duplicate when the same sourceId is ingested twice', () => {
    ingest(baseItem(), repo)
    const second = ingest(baseItem(), repo)
    expect(second.status).toBe('duplicate')
    const inboxFiles = readdirSync(join(repo, 'inbox'))
    expect(inboxFiles).toHaveLength(1)
    const log = git(repo, 'log', '--oneline')
    expect(log.trim().split('\n')).toHaveLength(1)
  })

  it('creates a second entry for a different sourceId', () => {
    ingest(baseItem(), repo)
    ingest(baseItem({ sourceId: 'manual#xyz789', content: '別の検討内容' }), repo)
    const inboxFiles = readdirSync(join(repo, 'inbox'))
    expect(inboxFiles).toHaveLength(2)
  })

  it('assigns a correlationId when the caller does not supply one', () => {
    const result = ingest(baseItem(), repo)
    expect(result.status).toBe('ingested')
    if (result.status === 'ingested') {
      expect(result.correlationId).toMatch(/^[0-9A-Z]{26}$/)
    }
  })

  it('does not stage unrelated dirty files sitting in the knowledge-repo', () => {
    writeFileSync(join(repo, 'unrelated.txt'), 'in-progress digest work')
    ingest(baseItem(), repo)
    const status = git(repo, 'status', '--porcelain', 'unrelated.txt')
    expect(status.trim()).toBe('?? unrelated.txt')
  })
})
