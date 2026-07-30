import { parse, stringify } from 'yaml'
import type { CapturedItem } from '@work-stream/contracts'
import { CapturedItemSchema } from '@work-stream/contracts'

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/

export function serializeCapturedItem(item: CapturedItem): string {
  const { content, ...frontmatter } = item
  const yamlBlock = stringify(frontmatter).trimEnd()
  return `---\n${yamlBlock}\n---\n\n${content}\n`
}

export function parseCapturedItem(markdown: string): CapturedItem {
  const match = FRONTMATTER_PATTERN.exec(markdown)
  if (!match) {
    throw new Error('invalid CapturedItem markdown: missing frontmatter block')
  }
  const [, frontmatterBlock, body] = match
  const frontmatter: unknown = parse(frontmatterBlock)
  return CapturedItemSchema.parse({
    ...(frontmatter as Record<string, unknown>),
    content: body.endsWith('\n') ? body.slice(0, -1) : body,
  })
}
