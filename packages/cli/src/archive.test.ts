import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { archive, resolveCollision, toArchiveRelPath, validateTarget } from './archive.js'

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf-8' })
}

function writeFile(repo: string, relPath: string, content: string): void {
  const absolute = join(repo, relPath)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

describe('validateTarget', () => {
  it('保管庫の外を指すパスは受け付けない', () => {
    // Arrange
    const repo = '/repo'

    // Act
    const result = validateTarget(repo, '../secrets.md')

    // Assert
    expect(result).toEqual({ ok: false, reason: '保管庫の外を指しています' })
  })

  it('既に archive/ 配下にあるパスは二重退避として弾く', () => {
    // Arrange
    const repo = '/repo'

    // Act
    const result = validateTarget(repo, 'archive/inbox/a.md')

    // Assert
    expect(result).toEqual({ ok: false, reason: '既に退避済みです' })
  })

  it('保管庫内の相対パスはそのまま正規化して返す', () => {
    // Arrange
    const repo = '/repo'

    // Act
    const result = validateTarget(repo, 'inbox/a.md')

    // Assert
    expect(result).toEqual({ ok: true, relPath: 'inbox/a.md' })
  })
})

describe('toArchiveRelPath', () => {
  it('元の階層を保ったまま archive/ の下へ対応づける', () => {
    // Arrange / Act / Assert
    expect(toArchiveRelPath('notes/tech/a.md')).toBe('archive/notes/tech/a.md')
  })
})

describe('resolveCollision', () => {
  it('空いていればそのまま使う', () => {
    // Arrange / Act
    const resolved = resolveCollision('archive/inbox/a.md', () => false)

    // Assert
    expect(resolved).toBe('archive/inbox/a.md')
  })

  it('埋まっていれば連番を付けて過去の退避物を上書きしない', () => {
    // Arrange
    const taken = new Set(['archive/inbox/a.md', 'archive/inbox/a-2.md'])

    // Act
    const resolved = resolveCollision('archive/inbox/a.md', (path) => taken.has(path))

    // Assert
    expect(resolved).toBe('archive/inbox/a-3.md')
  })
})

describe('archive', () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'ws-archive-'))
    git(repo, 'init')
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'user.name', 'test')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('inbox のファイルを階層ごと archive/ へ移動する', () => {
    // Arrange
    writeFile(repo, 'inbox/01ABC.md', '取り込んだ内容')

    // Act
    const outcomes = archive(repo, ['inbox/01ABC.md'])

    // Assert
    expect(outcomes).toEqual([
      { status: 'archived', from: 'inbox/01ABC.md', to: 'archive/inbox/01ABC.md' },
    ])
    expect(existsSync(join(repo, 'inbox/01ABC.md'))).toBe(false)
    expect(readFileSync(join(repo, 'archive/inbox/01ABC.md'), 'utf-8')).toBe('取り込んだ内容')
  })

  it('notes や knowledge にも同じ規則で使える', () => {
    // Arrange
    writeFile(repo, 'notes/tech/a.md', 'ノート')
    writeFile(repo, 'knowledge/content-creation/x-post.md', '型')

    // Act
    const outcomes = archive(repo, ['notes/tech/a.md', 'knowledge/content-creation/x-post.md'])

    // Assert
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['archived', 'archived'])
    expect(existsSync(join(repo, 'archive/notes/tech/a.md'))).toBe(true)
    expect(existsSync(join(repo, 'archive/knowledge/content-creation/x-post.md'))).toBe(true)
  })

  it('存在しないファイルは理由付きで飛ばし、他の対象の処理は続ける', () => {
    // Arrange
    writeFile(repo, 'inbox/exists.md', 'ある')

    // Act
    const outcomes = archive(repo, ['inbox/missing.md', 'inbox/exists.md'])

    // Assert
    expect(outcomes[0]).toEqual({
      status: 'skipped',
      from: 'inbox/missing.md',
      reason: '見つかりません',
    })
    expect(outcomes[1]?.status).toBe('archived')
  })

  it('同名を再度退避しても過去の退避物を上書きしない', () => {
    // Arrange
    writeFile(repo, 'inbox/a.md', '1回目')
    archive(repo, ['inbox/a.md'])
    writeFile(repo, 'inbox/a.md', '2回目')

    // Act
    const outcomes = archive(repo, ['inbox/a.md'])

    // Assert
    expect(outcomes[0]).toEqual({
      status: 'archived',
      from: 'inbox/a.md',
      to: 'archive/inbox/a-2.md',
    })
    expect(readFileSync(join(repo, 'archive/inbox/a.md'), 'utf-8')).toBe('1回目')
    expect(readFileSync(join(repo, 'archive/inbox/a-2.md'), 'utf-8')).toBe('2回目')
  })

  it('commit を指定すると移動元と移動先だけをコミットする', () => {
    // Arrange
    writeFile(repo, 'inbox/a.md', '内容')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-m', 'seed')
    writeFile(repo, 'notes/untouched.md', '無関係な作業中の変更')

    // Act
    archive(repo, ['inbox/a.md'], { commit: true })

    // Assert
    expect(git(repo, 'log', '--oneline')).toContain('chore(archive)')
    // 未追跡ディレクトリは既定でまとめて表示されるため、ファイル単位で確認する
    expect(git(repo, 'status', '--short', '--untracked-files=all')).toContain('notes/untouched.md')
  })

  it('dryRun ではファイルを動かさず、移動先の計算結果だけ返す', () => {
    // Arrange
    writeFile(repo, 'inbox/a.md', '内容')

    // Act
    const outcomes = archive(repo, ['inbox/a.md'], { dryRun: true })

    // Assert
    expect(outcomes[0]).toEqual({
      status: 'archived',
      from: 'inbox/a.md',
      to: 'archive/inbox/a.md',
    })
    expect(existsSync(join(repo, 'inbox/a.md'))).toBe(true)
    expect(existsSync(join(repo, 'archive/inbox/a.md'))).toBe(false)
  })

  it('commit を指定しなければ git には触れない', () => {
    // Arrange
    writeFile(repo, 'inbox/a.md', '内容')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-m', 'seed')

    // Act
    archive(repo, ['inbox/a.md'])

    // Assert
    expect(git(repo, 'status', '--short')).not.toBe('')
    expect(git(repo, 'log', '--oneline')).not.toContain('chore(archive)')
  })
})
