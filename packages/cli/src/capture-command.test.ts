import { describe, expect, it } from 'vitest'
import { buildCapturedItem } from './capture-command.js'

describe('buildCapturedItem', () => {
  const now = new Date('2026-07-28T09:00:00.000Z')

  it('derives sourceType manual and origin self', () => {
    const item = buildCapturedItem({ kind: 'thought', content: '内容A', cwd: '/repos/my-app', now })
    expect(item.sourceType).toBe('manual')
    expect(item.origin).toBe('self')
    expect(item.captureKind).toBe('thought')
  })

  it('derives sourceRef.project from the basename of cwd', () => {
    const item = buildCapturedItem({ kind: 'thought', content: '内容A', cwd: '/repos/my-app', now })
    expect(item.sourceRef?.project).toBe('my-app')
  })

  it('produces the same sourceId for identical content', () => {
    const a = buildCapturedItem({ kind: 'thought', content: '内容A', cwd: '/repos/my-app', now })
    const b = buildCapturedItem({ kind: 'thought', content: '内容A', cwd: '/repos/other', now })
    expect(a.sourceId).toBe(b.sourceId)
  })

  it('produces a different sourceId for different content', () => {
    const a = buildCapturedItem({ kind: 'thought', content: '内容A', cwd: '/repos/my-app', now })
    const b = buildCapturedItem({ kind: 'thought', content: '内容B', cwd: '/repos/my-app', now })
    expect(a.sourceId).not.toBe(b.sourceId)
  })

  it('uses the provided origin when specified', () => {
    const item = buildCapturedItem({
      kind: 'reference',
      content: '内容A',
      cwd: '/repos/my-app',
      now,
      origin: 'external',
    })
    expect(item.origin).toBe('external')
  })
})
