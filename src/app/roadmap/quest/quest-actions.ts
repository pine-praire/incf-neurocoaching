'use server'

import { questQuestionsBank } from '@/lib/quest-questions-bank'
import { LESSONS } from '@/lib/course-data'

// ── Public types (no `correct` flag, safe for client) ────────────────────────

export type QuestClientOption = { id: string; text: string }
export type QuestClientQuestion = {
  id: string
  question: string
  options: QuestClientOption[]
}
export type DailyQuest = {
  lessonId: string
  lessonTitle: string
  nextLessonId: string | null
  nextLessonTitle: string | null
  questions: QuestClientQuestion[]
}
export type QuestAnswerResult =
  | { ok: true; correct: boolean; correctOptionId: string; explanation: string }
  | { ok: false; error: 'not_found' | 'unknown' }

// ── Seeded RNG (mulberry32 + djb2-style hash) ─────────────────────────────────

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let s = seed
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function loadDailyQuest(
  completedLessonIds: string[],
): Promise<DailyQuest | null> {
  const bankLessonIds = new Set(questQuestionsBank.lessons.map((l) => l.lessonId))

  // Last completed lesson that has a quest, ordered by LESSONS array
  const completedWithQuest = LESSONS.filter(
    (l) => completedLessonIds.includes(l.id) && bankLessonIds.has(l.id),
  )
  if (completedWithQuest.length === 0) return null

  const lastLesson = completedWithQuest[completedWithQuest.length - 1]
  const bankLesson = questQuestionsBank.lessons.find(
    (l) => l.lessonId === lastLesson.id,
  )
  if (!bankLesson) return null

  const today = new Date().toISOString().slice(0, 10)

  // Select 5 questions deterministically by day
  const shuffledQuestions = seededShuffle(
    bankLesson.questions,
    hashString(lastLesson.id + today),
  )
  const selected = shuffledQuestions.slice(0, 5)

  // Build client questions: stable option IDs, shuffle order, strip correct flag
  const clientQuestions: QuestClientQuestion[] = selected.map((q) => {
    const optionsWithIds: QuestClientOption[] = q.options.map((opt, i) => ({
      id: `${q.id}-o${i}`,
      text: opt.text,
    }))
    const shuffledOptions = seededShuffle(
      optionsWithIds,
      hashString(q.id + today),
    )
    return { id: q.id, question: q.question, options: shuffledOptions }
  })

  const nextLesson = LESSONS.find((l) => !completedLessonIds.includes(l.id)) ?? null

  return {
    lessonId: lastLesson.id,
    lessonTitle: lastLesson.title,
    nextLessonId: nextLesson?.id ?? null,
    nextLessonTitle: nextLesson?.title ?? null,
    questions: clientQuestions,
  }
}

export async function checkQuestAnswer(
  questionId: string,
  optionId: string,
): Promise<QuestAnswerResult> {
  let foundQuestion: (typeof questQuestionsBank.lessons)[number]['questions'][number] | undefined

  for (const lesson of questQuestionsBank.lessons) {
    foundQuestion = lesson.questions.find((q) => q.id === questionId)
    if (foundQuestion) break
  }

  if (!foundQuestion) return { ok: false, error: 'not_found' }

  // Read the actual correct flag — do not assume position in source
  const correctIdx = foundQuestion.options.findIndex((o) => o.correct)
  if (correctIdx === -1) return { ok: false, error: 'unknown' }

  const correctOptionId = `${questionId}-o${correctIdx}`

  return {
    ok: true,
    correct: optionId === correctOptionId,
    correctOptionId,
    explanation: foundQuestion.explanation,
  }
}
