import { describe, expect, it } from 'vitest'
import { EventEnvelopeSchema, ItemCapturedEventSchema } from './event.js'

describe('EventEnvelopeSchema', () => {
  const valid = {
    eventId: '01J8ZQEXAMPLE00000000000',
    type: 'Ingest.ItemCaptured',
    schemaVersion: '1.0.0',
    occurredAt: '2026-07-28T09:00:00.000Z',
    producer: 'ingest@0.0.1',
    dedupeKey: 'manual#abc123',
    correlationId: '01J8ZQEXAMPLE00000000000',
    payload: { foo: 'bar' },
  }

  it('accepts a well-formed event envelope', () => {
    expect(EventEnvelopeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a missing dedupeKey', () => {
    const { dedupeKey, ...rest } = valid
    expect(EventEnvelopeSchema.safeParse(rest).success).toBe(false)
  })
})

describe('ItemCapturedEventSchema', () => {
  it('rejects a type other than Ingest.ItemCaptured', () => {
    const invalid = {
      eventId: '01J8ZQEXAMPLE00000000000',
      type: 'Something.Else',
      schemaVersion: '1.0.0',
      occurredAt: '2026-07-28T09:00:00.000Z',
      producer: 'ingest@0.0.1',
      dedupeKey: 'manual#abc123',
      correlationId: '01J8ZQEXAMPLE00000000000',
      payload: {},
    }
    expect(ItemCapturedEventSchema.safeParse(invalid).success).toBe(false)
  })
})
