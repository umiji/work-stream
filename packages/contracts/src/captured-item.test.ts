import { describe, expect, it } from 'vitest'
import { CapturedItemSchema } from './captured-item.js'

describe('CapturedItemSchema', () => {
  const valid = {
    sourceType: 'manual',
    sourceId: 'manual#abc123',
    captureKind: 'thought',
    origin: 'self',
    capturedAt: '2026-07-28T09:00:00.000Z',
    correlationId: '01J8ZQEXAMPLE00000000000',
    sourceRef: { project: 'my-app' },
    tags: [],
    content: '検討の結論をここに書く',
  }

  it('accepts a well-formed CapturedItem', () => {
    const result = CapturedItemSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects an invalid sourceType', () => {
    const result = CapturedItemSchema.safeParse({ ...valid, sourceType: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid captureKind', () => {
    const result = CapturedItemSchema.safeParse({ ...valid, captureKind: 'idea' })
    expect(result.success).toBe(false)
  })

  it('defaults sourceRef and tags when omitted', () => {
    const { sourceRef, tags, ...rest } = valid
    const result = CapturedItemSchema.parse(rest)
    expect(result.sourceRef).toEqual({})
    expect(result.tags).toEqual([])
  })

  it('rejects empty content', () => {
    const result = CapturedItemSchema.safeParse({ ...valid, content: '' })
    expect(result.success).toBe(false)
  })
})
