import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMarker, hasBeenIngested, hashSourceId, markerPath } from './idempotency.js'

describe('idempotency markers', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'ws-idempotency-'))
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('hashes the same sourceId to the same value', () => {
    expect(hashSourceId('manual#abc')).toBe(hashSourceId('manual#abc'))
  })

  it('hashes different sourceIds to different values', () => {
    expect(hashSourceId('manual#abc')).not.toBe(hashSourceId('manual#xyz'))
  })

  it('reports not-yet-ingested before a marker exists', () => {
    expect(hasBeenIngested(repo, 'manual#abc')).toBe(false)
  })

  it('reports ingested after createMarker is called', () => {
    createMarker(repo, 'manual#abc')
    expect(hasBeenIngested(repo, 'manual#abc')).toBe(true)
  })

  it('does not mark an unrelated sourceId as ingested', () => {
    createMarker(repo, 'manual#abc')
    expect(hasBeenIngested(repo, 'manual#xyz')).toBe(false)
  })

  it('places the marker under .system/state/ingest/seen/', () => {
    const path = markerPath(repo, 'manual#abc')
    expect(path.replaceAll('\\', '/')).toContain('/.system/state/ingest/seen/')
  })
})
