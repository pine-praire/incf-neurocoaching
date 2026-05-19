export function getDisplayName(
  metadata: Record<string, unknown>,
  email: string | undefined
): string {
  return (
    (metadata?.name as string | undefined) ||
    (metadata?.full_name as string | undefined) ||
    email?.split('@')[0] ||
    'Участник'
  )
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function countCompletedLessons(
  progressRows: Array<{ step_id: string }>,
  lessonIds: string[],
  finalIds: string[]
): number {
  const ids = new Set([...lessonIds, ...finalIds])
  return progressRows.filter(p => ids.has(p.step_id)).length
}

export function getProgressPercent(completed: number, total: number): number {
  if (total === 0) return 0
  return (completed / total) * 100
}
