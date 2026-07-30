import { z } from 'zod'

export const SourceTypeSchema = z.enum([
  'claude-code',
  'gemini',
  'claude-chat',
  'chatgpt',
  'manual',
  'issue',
])
export type SourceType = z.infer<typeof SourceTypeSchema>

export const CaptureKindSchema = z.enum(['thought', 'reference', 'log'])
export type CaptureKind = z.infer<typeof CaptureKindSchema>

export const OriginSchema = z.enum(['self', 'external'])
export type Origin = z.infer<typeof OriginSchema>

export const SourceRefSchema = z
  .object({
    docUrl: z.string().url().optional(),
    conversationUrl: z.string().url().optional(),
    project: z.string().optional(),
  })
  .strict()
export type SourceRef = z.infer<typeof SourceRefSchema>

export const CapturedItemSchema = z.object({
  sourceType: SourceTypeSchema,
  sourceId: z.string().min(1),
  captureKind: CaptureKindSchema,
  origin: OriginSchema,
  capturedAt: z.string().datetime({ offset: true }),
  originalTimestamp: z.string().datetime({ offset: true }).optional(),
  correlationId: z.string().min(1),
  sourceRef: SourceRefSchema.default({}),
  tags: z.array(z.string()).default([]),
  content: z.string().min(1),
})
export type CapturedItem = z.infer<typeof CapturedItemSchema>
