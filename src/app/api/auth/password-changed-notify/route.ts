import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPasswordChangedEmail } from "@/lib/brevo"

export const runtime = "nodejs"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await sendPasswordChangedEmail(user.email)
  } catch (err) {
    console.error("password-changed-notify: Brevo error", err)
  }

  return NextResponse.json({ ok: true })
}
