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

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: true })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (profileError) {
    console.error("profiles lookup failed:", profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: 'not_registered' }, { status: 404 })
  }

  const { data: activeEnrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (enrollmentError) {
    console.error("enrollment lookup failed:", enrollmentError)
    return NextResponse.json({ error: enrollmentError.message }, { status: 500 })
  }

  if (!activeEnrollment) {
    return NextResponse.json({ error: 'not_registered' }, { status: 404 })
  }

  let magicLink: string
  try {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })
    if (linkError) throw linkError
    magicLink = linkData?.properties?.action_link ?? ''
  } catch (err) {
    const msg = err instanceof Error ? err.message
      : (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as { message: unknown }).message)
        : String(err)
    console.error('generateLink failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (magicLink) {
    try {
      await sendMagicLinkEmail(email, magicLink)
    } catch (emailError) {
      console.error('Failed to resend magic link:', emailError)
    }
  }

  return NextResponse.json({ ok: true })
}
