import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { monotonicFactory } from 'ulid'
import type { CapturedItem } from '@work-stream/contracts'
import { createMarker, hasBeenIngested } from './idempotency.js'
import { serializeCapturedItem } from './markdown.js'

const ulid = monotonicFactory()

export type IngestResult =
  | { status: 'ingested'; path: string; correlationId: string }
  | { status: 'duplicate'; path: string }

function runGit(repo: string, args: string[]): void {
  execFileSync('git', args, { cwd: repo, encoding: 'utf-8' })
}

export function ingest(
  item: Omit<CapturedItem, 'correlationId'> & { correlationId?: string },
  knowledgeRepoPath: string,
): IngestResult {
  const inboxDir = join(knowledgeRepoPath, 'inbox')

  if (hasBeenIngested(knowledgeRepoPath, item.sourceId)) {
    return { status: 'duplicate', path: inboxDir }
  }

  const correlationId = item.correlationId ?? ulid()
  const fullItem: CapturedItem = { ...item, correlationId }
  const filePath = join(inboxDir, `${correlationId}.md`)

  mkdirSync(inboxDir, { recursive: true })
  writeFileSync(filePath, serializeCapturedItem(fullItem))
  createMarker(knowledgeRepoPath, item.sourceId)

  runGit(knowledgeRepoPath, ['add', '-A'])
  runGit(knowledgeRepoPath, [
    'commit',
    '-m',
    `feat(ingest): capture ${item.captureKind} ${correlationId}`,
  ])

  return { status: 'ingested', path: filePath, correlationId }
}
