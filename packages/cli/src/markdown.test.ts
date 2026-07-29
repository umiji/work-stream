import { describe, expect, it } from 'vitest'
import type { CapturedItem } from '@work-stream/contracts'
import { parseCapturedItem, serializeCapturedItem } from './markdown.js'

describe('serializeCapturedItem / parseCapturedItem', () => {
  const item: CapturedItem = {
    sourceType: 'manual',
    sourceId: 'manual#abc123',
    captureKind: 'thought',
    origin: 'self',
    capturedAt: '2026-07-28T09:00:00.000Z',
    correlationId: '01J8ZQEXAMPLE00000000000',
    sourceRef: { project: 'my-app' },
    tags: ['work-stream'],
    content: '検討の結論をここに書く。\n複数行の本文。',
  }

  it('round-trips through markdown without loss', () => {
    const markdown = serializeCapturedItem(item)
    const parsed = parseCapturedItem(markdown)
    expect(parsed).toEqual(item)
  })

  it('writes a frontmatter block followed by the body', () => {
    const markdown = serializeCapturedItem(item)
    expect(markdown.startsWith('---\n')).toBe(true)
    expect(markdown).toContain('sourceId: manual#abc123')
    expect(markdown).toContain('検討の結論をここに書く。')
  })

  it('throws on markdown without a frontmatter block', () => {
    expect(() => parseCapturedItem('本文だけ')).toThrow()
  })

  it('preserves a trailing newline that is part of the content itself', () => {
    const itemWithTrailingNewline: CapturedItem = {
      ...item,
      content: '本文の末尾に改行がある。\n',
    }
    const markdown = serializeCapturedItem(itemWithTrailingNewline)
    const parsed = parseCapturedItem(markdown)
    expect(parsed).toEqual(itemWithTrailingNewline)
  })
})
