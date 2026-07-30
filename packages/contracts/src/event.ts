import { z } from 'zod'

export const EventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  type: z.string().min(1),
  schemaVersion: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  producer: z.string().min(1),
  dedupeKey: z.string().min(1),
  correlationId: z.string().min(1),
  payload: z.record(z.unknown()),
})
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>

export const ItemCapturedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal('Ingest.ItemCaptured'),
})
export type ItemCapturedEvent = z.infer<typeof ItemCapturedEventSchema>
