import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendMagicLinkEmail } from "@/lib/brevo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ ok: true })
  }

  const { data: activeEnrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (!activeEnrollment) {
    return NextResponse.json({ ok: true })
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  const magicLink = linkData.properties.action_link ?? ''

  if (magicLink) {
    try {
      await sendMagicLinkEmail(email, magicLink)
    } catch (emailError) {
      console.error('Failed to resend magic link:', emailError)
    }
  }

  return NextResponse.json({ ok: true })
}
