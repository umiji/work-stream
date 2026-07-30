import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function hashSourceId(sourceId: string): string {
  return createHash('sha256').update(sourceId, 'utf-8').digest('hex')
}

export function markerPath(knowledgeRepoPath: string, sourceId: string): string {
  return join(knowledgeRepoPath, '.system', 'state', 'ingest', 'seen', hashSourceId(sourceId))
}

export function hasBeenIngested(knowledgeRepoPath: string, sourceId: string): boolean {
  return existsSync(markerPath(knowledgeRepoPath, sourceId))
}

export function createMarker(knowledgeRepoPath: string, sourceId: string): string {
  const target = markerPath(knowledgeRepoPath, sourceId)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, '')
  return target
}
