import { generateTempPassword } from '@/lib/auth-utils'
import type { createSupabaseAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function lookupAuthUserByEmail(email: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=10`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!res.ok) return null
    const body = await res.json()
    const users = body.users as Array<{ id: string; email: string }> | undefined
    return users?.find(u => u.email === email)?.id ?? null
  } catch {
    return null
  }
}

export interface GrantCourseAccessOptions {
  email: string
  courseId: string
  getcourseOrderId?: string
  getcourseUserId?: string
  firstName?: string
  lastName?: string
  phone?: string
}

export async function grantCourseAccess(
  supabase: AdminClient,
  options: GrantCourseAccessOptions
): Promise<{ userId: string }> {
  const { email, courseId, getcourseOrderId, getcourseUserId, firstName, lastName, phone } = options

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  let userId: string

  if (existingProfile) {
    userId = existingProfile.id
  } else {
    const displayName = firstName ? `${firstName} ${lastName ?? ''}`.trim() : email.split('@')[0]
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: generateTempPassword(),
      email_confirm: true,
      user_metadata: {
        getcourse_user_id: getcourseUserId,
        first_name: firstName,
        last_name: lastName,
        name: displayName,
      },
    })

    if (!createError) {
      if (!createData.user) throw new Error('User was not created')
      userId = createData.user.id
    } else {
      const existingAuthId = await lookupAuthUserByEmail(email)
      if (!existingAuthId) throw createError
      userId = existingAuthId
    }
  }

  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    getcourse_user_id: getcourseUserId,
    first_name: firstName,
    last_name: lastName,
    phone,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (profileErr) throw profileErr

  // Preserve existing order_id if already enrolled (don't overwrite a purchase enrollment)
  const { data: existingEnrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (existingEnrollment) {
    const { error: enrollErr } = await supabase
      .from('enrollments')
      .update({ status: 'active' })
      .eq('id', existingEnrollment.id)
    if (enrollErr) throw enrollErr
  } else {
    const { error: enrollErr } = await supabase.from('enrollments').insert({
      user_id: userId,
      course_id: courseId,
      getcourse_order_id: getcourseOrderId ?? null,
      status: 'active',
      starts_at: new Date().toISOString(),
    })
    if (enrollErr) throw enrollErr
  }

  return { userId }
}
