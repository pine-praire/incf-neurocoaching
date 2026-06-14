import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendPasswordResetEmail } from "@/lib/brevo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ notEnrolled: true })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}/auth/callback?type=recovery` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: "Failed to generate reset link" }, { status: 500 })
  }

  await sendPasswordResetEmail(email, linkData.properties.action_link)

  return NextResponse.json({ ok: true })
}
