'use server'

import { createClient } from '@/lib/supabase/server'
import { LESSONS, FINALS, INTRO } from '@/lib/course-data'

function getXP(stepId: string): number {
  if (stepId === 'intro') return INTRO.xp
  const lesson = LESSONS.find(l => l.id === stepId)
  if (lesson) return lesson.xp
  const final = FINALS.find(f => f.id === stepId)
  if (final) return final.xp
  return 0
}

function getStepType(stepId: string): 'intro' | 'lesson' | 'final' {
  if (stepId === 'intro') return 'intro'
  if (LESSONS.find(l => l.id === stepId)) return 'lesson'
  return 'final'
}

// Mark a lesson/final as done
export async function markStepDone(stepId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const xp = getXP(stepId)
  const stepType = getStepType(stepId)

  const { error } = await supabase
    .from('progress')
    .upsert({ user_id: user.id, step_id: stepId, step_type: stepType, xp_awarded: xp },
      { onConflict: 'user_id,step_id' })

  if (error) return { error: error.message }
  return { ok: true, xp }
}

// Undo a step
export async function undoStep(stepId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('progress')
    .delete()
    .eq('user_id', user.id)
    .eq('step_id', stepId)

  if (error) return { error: error.message }
  return { ok: true }
}

// Save answer to a lesson task
export async function saveAnswer(lessonId: string, text: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('answers')
    .upsert({ user_id: user.id, lesson_id: lessonId, text, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' })

  if (error) return { error: error.message }
  return { ok: true }
}

// Load all progress for current user
export async function loadProgress() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { completed: [], answers: {} }

  const [{ data: progress }, { data: answers }] = await Promise.all([
    supabase.from('progress').select('step_id').eq('user_id', user.id),
    supabase.from('answers').select('lesson_id, text').eq('user_id', user.id),
  ])

  return {
    completed: (progress ?? []).map(p => p.step_id),
    answers: Object.fromEntries((answers ?? []).map(a => [a.lesson_id, a.text ?? ''])),
  }
}
