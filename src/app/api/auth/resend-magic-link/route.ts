import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

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

  const { data: linkData, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // TODO: отправить через Resend
  console.log("Resend magic link for", email, linkData.properties.action_link)

  return NextResponse.json({ ok: true })
}
