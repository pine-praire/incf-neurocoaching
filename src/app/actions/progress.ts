'use server'

import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { LESSONS, FINALS, INTRO } from '@/lib/course-data'

const VALID_STEP_IDS = new Set([
  'intro',
  ...LESSONS.map(l => l.id),
  ...FINALS.map(f => f.id),
])

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
  if (!VALID_STEP_IDS.has(stepId)) return { error: 'Invalid step' }
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
  if (!VALID_STEP_IDS.has(stepId)) return { error: 'Invalid step' }
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
  if (!VALID_STEP_IDS.has(lessonId)) return { error: 'Invalid step' }
  if (text.length > 2000) return { error: 'Too long' }
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

// Save certificate name
export async function saveCertificateName(name: string) {
  if (name.trim().length === 0) return { error: 'Имя не может быть пустым' }
  if (name.length > 200) return { error: 'Имя слишком длинное (максимум 200 символов)' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('answers')
    .upsert(
      { user_id: user.id, lesson_id: 'certificate_name', text: name, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    )

  if (error) return { error: error.message }
  return { ok: true }
}

export async function saveSixAnswers(answersMap: Record<string, string>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const rows = Object.entries(answersMap).map(([lesson_id, text]) => ({
    user_id: user.id,
    lesson_id,
    text: text.slice(0, 2000),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('answers')
    .upsert(rows, { onConflict: 'user_id,lesson_id' })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function issueCertificate(name: string): Promise<{
  ok?: boolean; certNumber?: number; name?: string; issuedAt?: string; emailSent?: boolean; error?: string
}> {
  const trimmedName = name.trim()
  if (!trimmedName) return { error: 'Введите имя' }
  if (trimmedName.length > 200) return { error: 'Имя слишком длинное' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: progressRows } = await supabase
    .from('progress')
    .select('step_id')
    .eq('user_id', user.id)

  const completedSteps = new Set((progressRows ?? []).map((p: { step_id: string }) => p.step_id))
  if (!LESSONS.every(l => completedSteps.has(l.id))) {
    return { error: 'Необходимо пройти все уроки курса' }
  }

  const admin = createSupabaseAdminClient()

  const { data: existing } = await admin
    .from('certificates')
    .select('cert_number, name, issued_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return { ok: true, certNumber: existing.cert_number, name: existing.name, issuedAt: existing.issued_at }
  }

  const { data: cert, error } = await admin
    .from('certificates')
    .insert({ user_id: user.id, name: trimmedName })
    .select('cert_number, name, issued_at')
    .single()

  if (error || !cert) return { error: error?.message ?? 'Не удалось создать сертификат' }

  let emailSent = false
  try {
    const { generateCertificatePDF } = await import('@/lib/certificate-pdf')
    const { sendCertificateEmail } = await import('@/lib/brevo')
    const pdfBuffer = await generateCertificatePDF(cert.name, cert.cert_number, cert.issued_at)
    if (user.email) {
      await sendCertificateEmail(user.email, cert.name, cert.cert_number, cert.issued_at, pdfBuffer)
      emailSent = true
    }
  } catch (e) {
    console.error('[issueCertificate] email/pdf failed:', e)
  }

  return { ok: true, certNumber: cert.cert_number, name: cert.name, issuedAt: cert.issued_at, emailSent }
}

function computeStreak(createdAts: string[]): number {
  if (createdAts.length === 0) return 0
  const days = Array.from(new Set(createdAts.map(d => d.slice(0, 10)))).sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (days[0] !== today && days[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86_400_000
    if (diff === 1) streak++
    else break
  }
  return streak
}

// Load all progress for current user
export async function loadProgress() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { completed: [], answers: {}, userName: '', streak: 0, certificate: null as null | { certNumber: number; name: string; issuedAt: string } }

  const [{ data: progress }, { data: answers }, { data: cert }] = await Promise.all([
    supabase.from('progress').select('step_id, completed_at').eq('user_id', user.id),
    supabase.from('answers').select('lesson_id, text').eq('user_id', user.id),
    supabase.from('certificates').select('cert_number, name, issued_at').eq('user_id', user.id).maybeSingle(),
  ])

  const userName = user.user_metadata?.name
    || user.user_metadata?.full_name
    || user.user_metadata?.display_name
    || user.email?.split('@')[0]
    || ''

  const streak = computeStreak((progress ?? []).map(p => p.completed_at ?? ''))

  return {
    completed: (progress ?? []).map(p => p.step_id),
    answers: Object.fromEntries((answers ?? []).map(a => [a.lesson_id, a.text ?? ''])),
    userName,
    streak,
    certificate: cert ? { certNumber: cert.cert_number, name: cert.name, issuedAt: cert.issued_at } : null,
  }
}
