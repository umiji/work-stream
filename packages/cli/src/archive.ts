import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'

/** 処理済みファイルの退避先。knowledge-repo のトップレベルに置く */
export const ARCHIVE_DIRNAME = 'archive'

export type ArchiveOutcome =
  | { status: 'archived'; from: string; to: string }
  | { status: 'skipped'; from: string; reason: string }

/** パス区切りを POSIX 形式に揃える(Windows で `\` になるのを防ぐ) */
function toPosix(path: string): string {
  return path.split('\\').join('/')
}

export type TargetValidation =
  | { ok: true; relPath: string }
  | { ok: false; reason: string }

/**
 * 退避対象が保管庫の中にあり、かつ二重退避でないことを確認して
 * 保管庫ルートからの相対パスへ正規化する。
 */
export function validateTarget(repoPath: string, target: string): TargetValidation {
  const absolute = isAbsolute(target) ? resolve(target) : resolve(repoPath, target)
  const relPath = toPosix(relative(resolve(repoPath), absolute))

  if (relPath.length === 0 || relPath.startsWith('../')) {
    return { ok: false, reason: '保管庫の外を指しています' }
  }
  if (relPath === ARCHIVE_DIRNAME || relPath.startsWith(`${ARCHIVE_DIRNAME}/`)) {
    return { ok: false, reason: '既に退避済みです' }
  }
  return { ok: true, relPath }
}

/** `inbox/x.md` を `archive/inbox/x.md` に対応づける(元の階層をそのまま残す) */
export function toArchiveRelPath(relPath: string): string {
  return `${ARCHIVE_DIRNAME}/${relPath}`
}

/**
 * 退避先が既に埋まっている場合に `-2`, `-3` … を付けて空きを探す。
 * 同名ファイルを何度も退避しても、過去の退避物を上書きしない。
 */
export function resolveCollision(
  archiveRelPath: string,
  isTaken: (relPath: string) => boolean,
): string {
  if (!isTaken(archiveRelPath)) {
    return archiveRelPath
  }
  const extension = extname(archiveRelPath)
  const stem = archiveRelPath.slice(0, archiveRelPath.length - extension.length)
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${stem}-${suffix}${extension}`
    if (!isTaken(candidate)) {
      return candidate
    }
  }
}

function runGit(repoPath: string, args: string[]): void {
  execFileSync('git', args, { cwd: repoPath, encoding: 'utf-8' })
}

export interface ArchiveOptions {
  /** git のコミットまで行うか(テストや下見では false にする) */
  commit?: boolean
  message?: string
  /** ファイルを動かさず、移動先の計算だけ行う */
  dryRun?: boolean
}

/**
 * 指定されたファイルを `archive/` 配下へ、元の階層を保ったまま移動する。
 * inbox / notes / knowledge のいずれにも同じ規則で使える。
 */
export function archive(
  repoPath: string,
  targets: readonly string[],
  options: ArchiveOptions = {},
): ArchiveOutcome[] {
  const outcomes: ArchiveOutcome[] = []
  const movedRelPaths: string[] = []

  for (const target of targets) {
    const validation = validateTarget(repoPath, target)
    if (!validation.ok) {
      outcomes.push({ status: 'skipped', from: target, reason: validation.reason })
      continue
    }

    const sourceAbsolute = join(repoPath, validation.relPath)
    if (!existsSync(sourceAbsolute)) {
      outcomes.push({ status: 'skipped', from: validation.relPath, reason: '見つかりません' })
      continue
    }

    const destinationRelPath = resolveCollision(toArchiveRelPath(validation.relPath), (candidate) =>
      existsSync(join(repoPath, candidate)),
    )
    const destinationAbsolute = join(repoPath, destinationRelPath)

    if (options.dryRun !== true) {
      mkdirSync(dirname(destinationAbsolute), { recursive: true })
      renameSync(sourceAbsolute, destinationAbsolute)
      movedRelPaths.push(validation.relPath, destinationRelPath)
    }

    outcomes.push({ status: 'archived', from: validation.relPath, to: destinationRelPath })
  }

  if (options.commit === true && movedRelPaths.length > 0) {
    const archivedCount = outcomes.filter((outcome) => outcome.status === 'archived').length
    // 移動元と移動先だけを対象にする(取り込み処理と同じく、無関係な変更を巻き込まない)
    runGit(repoPath, ['add', '--', ...movedRelPaths])
    runGit(repoPath, [
      'commit',
      '-m',
      options.message ?? `chore(archive): 処理済みの ${archivedCount} 件を archive/ へ移動`,
    ])
  }

  return outcomes
}
