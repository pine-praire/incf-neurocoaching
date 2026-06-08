import { createClient } from '@supabase/supabase-js'
import { getCourseIdByOfferId } from '../src/lib/getcourse/access-map'

const DRY_RUN = process.env.DRY_RUN === '1'

const EMAIL_CORRECTIONS: Record<string, string> = {
  'tomsciy@icloud.con': 'tomsciy@icloud.com',
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: events, error } = await supabase
    .from('webhook_events')
    .select('id, payload')
    .like('error', 'Payment status is not paid: Завершен%')

  if (error) throw error
  if (!events?.length) { console.log('No failed events found'); return }

  // Дедупликация по email — один человек обрабатывается один раз
  const byEmail = new Map<string, { payload: Record<string, string>; eventIds: number[] }>()
  for (const ev of events) {
    const p = ev.payload as Record<string, string>
    const rawEmail = p.email?.trim().toLowerCase()
    if (!rawEmail) continue
    const email = EMAIL_CORRECTIONS[rawEmail] ?? rawEmail
    const existing = byEmail.get(email)
    if (existing) {
      existing.eventIds.push(ev.id)
    } else {
      byEmail.set(email, { payload: p, eventIds: [ev.id] })
    }
  }

  console.log(`${events.length} events → ${byEmail.size} unique emails${DRY_RUN ? ' (DRY RUN)' : ''}`)

  let created = 0, skipped = 0, failed = 0

  for (const [email, { payload, eventIds }] of byEmail) {
    const courseId = getCourseIdByOfferId(payload.offer_id)
    if (!courseId) {
      console.warn(`${email}: unknown offer_id ${payload.offer_id}, skipping`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`[dry] would enroll ${email} → ${courseId} (order ${payload.order_id})`)
      created++
      continue
    }

    try {
      // Найти или создать пользователя (проверка профиля даёт идемпотентность)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      let userId: string
      if (existingProfile) {
        userId = existingProfile.id
      } else {
        const { data, error: createErr } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            first_name: payload.first_name,
            last_name: payload.last_name,
            getcourse_user_id: payload.getcourse_user_id,
          },
        })
        if (createErr) throw createErr
        if (!data.user) throw new Error('User not created')
        userId = data.user.id
      }

      await supabase.from('profiles').upsert({
        id: userId,
        email,
        getcourse_user_id: payload.getcourse_user_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      await supabase.from('enrollments').upsert({
        user_id: userId,
        course_id: courseId,
        getcourse_order_id: payload.order_id,
        status: 'active',
        starts_at: new Date().toISOString(),
      }, { onConflict: 'user_id,course_id' })

      // Пометить все события этого email обработанными + снять error,
      // чтобы возможный ретрай GetCourse не запустил повторную отправку письма
      await supabase
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString(), error: null })
        .in('id', eventIds)

      console.log(`${email}: enrolled`)
      created++
    } catch (err) {
      console.error(`${email}: FAILED —`, err)
      failed++
    }
  }

  console.log(`\nDone. enrolled: ${created}, skipped: ${skipped}, failed: ${failed}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
