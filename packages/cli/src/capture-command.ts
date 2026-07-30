import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import type { CapturedItem, CaptureKind, Origin } from '@work-stream/contracts'

export interface CaptureInput {
  kind: CaptureKind
  content: string
  cwd: string
  now: Date
  origin?: Origin
}

export function buildCapturedItem(input: CaptureInput): Omit<CapturedItem, 'correlationId'> {
  const contentHash = createHash('sha256').update(input.content, 'utf-8').digest('hex')
  return {
    sourceType: 'manual',
    sourceId: `manual#${contentHash}`,
    captureKind: input.kind,
    origin: input.origin ?? 'self',
    capturedAt: input.now.toISOString(),
    sourceRef: { project: basename(input.cwd) },
    tags: [],
    content: input.content,
  }
}
