import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

export const WorkStreamConfigSchema = z.object({
  knowledgeRepo: z.string().min(1),
  defaultDomain: z.string().min(1),
})
export type WorkStreamConfig = z.infer<typeof WorkStreamConfigSchema>

export function defaultConfigPath(): string {
  return join(homedir(), '.config', 'work-stream', 'config.json')
}

export function loadConfig(configPath: string = defaultConfigPath()): WorkStreamConfig {
  const raw = readFileSync(configPath, 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  return WorkStreamConfigSchema.parse(parsed)
}
