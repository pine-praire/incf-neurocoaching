import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.env.DRY_RUN === '1'
const COURSE_ID = 'neurocoaching-intro'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USERS: { email: string; first_name?: string; last_name?: string }[] = [
  { email: 'lyashenkomargarita03@gmail.com', first_name: 'Марго', last_name: 'Liashenko' },
  { email: 'bezrukova.marya.marya@gmail.com', first_name: 'bezrukova.marya.marya' },
  { email: 'rybokota@gmail.com', first_name: 'Александра', last_name: 'Каурова' },
  { email: 'tatiana.hliak@gmail.com', first_name: 'Татьяна' },
  { email: 'lersme@mail.ru', first_name: 'Валерия', last_name: 'Журавкова' },
  { email: 'wowcaramel@ya.ru', first_name: 'Ирина' },
  { email: 'xvasenkova@gmail.com', first_name: 'Xenia', last_name: 'Kulikova' },
  { email: 'irinavladart@gmail.com', first_name: 'Ирина', last_name: 'Artamonova' },
  { email: 'darjatretjakova@gmail.com', first_name: 'Darja' },
  { email: 'annamashek@gmail.com', first_name: 'Anna', last_name: 'Mashek' },
  { email: 'v3n6p8@mail.ru', first_name: 'Надежда' },
  { email: 'alina0061@gmail.com', first_name: 'Алина' },
  { email: 'banaflya@mail.ru', first_name: 'Людмила' },
  { email: 'aeronastya.tut@gmail.com', first_name: 'Anastasia' },
  { email: 'starossta19@mail.ru', first_name: 'Юля' },
  { email: 'maria.ankudimova@yandex.ru', first_name: 'Мария' },
  { email: 'alinep1299@gmail.com', first_name: 'Alina' },
  { email: 'nadezhdalnk783@gmail.com', first_name: 'Надежда', last_name: 'Бурмистрова' },
  { email: 'alshmakova@gmail.com', first_name: 'Alina', last_name: 'Shmakova' },
  { email: 'tutulya4@gmail.com', first_name: 'Юлиана', last_name: 'Амелина' },
  { email: 'dashahse@yandex.ru', first_name: 'Дарья' },
  { email: 'marquespuget@gmail.com', first_name: 'Sabina', last_name: 'Rufullayeva' },
]

async function main() {
  console.log(`${USERS.length} users to backfill${DRY_RUN ? ' (DRY RUN)' : ''}`)

  let created = 0, skipped = 0, failed = 0

  for (const user of USERS) {
    const email = user.email.trim().toLowerCase()

    if (DRY_RUN) {
      console.log(`[dry] would enroll ${email} → ${COURSE_ID}`)
      created++
      continue
    }

    try {
      const { data: existingProfile } = await supabase
        .from('profiles').select('id').eq('email', email).maybeSingle()

      let userId: string
      if (existingProfile) {
        userId = existingProfile.id
        console.log(`${email}: profile exists, updating enrollment`)
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
          },
        })
        if (error) throw error
        if (!data.user) throw new Error('User not created')
        userId = data.user.id
      }

      await supabase.from('profiles').upsert({
        id: userId,
        email,
        first_name: user.first_name,
        last_name: user.last_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      await supabase.from('enrollments').upsert({
        user_id: userId,
        course_id: COURSE_ID,
        getcourse_order_id: `manual-backfill-${email}`,
        status: 'active',
        starts_at: new Date().toISOString(),
      }, { onConflict: 'user_id,course_id' })

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
