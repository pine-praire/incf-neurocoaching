import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { GetCoursePurchasePayload } from "@/lib/getcourse/types"
import { getCourseIdByOfferId } from "@/lib/getcourse/access-map"

export const runtime = "nodejs"

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isPaidStatus(status?: string) {
  if (!status) return false
  const normalized = status.trim().toLowerCase()
  return ["paid", "success", "оплачен", "оплачено"].includes(normalized)
}

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()

  const secretFromHeader = request.headers.get("x-getcourse-secret")
  const secretFromQuery = new URL(request.url).searchParams.get("secret")
  const expectedSecret = process.env.GETCOURSE_WEBHOOK_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 })
  }

  if (secretFromHeader !== expectedSecret && secretFromQuery !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: GetCoursePurchasePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventKey = payload.order_id ? `purchase:${payload.order_id}` : undefined

  const { data: eventLog } = await supabase
    .from("webhook_events")
    .insert({
      provider: "getcourse",
      event_type: "purchase_paid",
      event_key: eventKey,
      payload,
    })
    .select("id")
    .single()

  try {
    if (!payload.email) throw new Error("Missing email")
    if (!payload.order_id) throw new Error("Missing order_id")
    if (!payload.offer_id) throw new Error("Missing offer_id")
    if (!isPaidStatus(payload.payment_status)) throw new Error(`Payment status is not paid: ${payload.payment_status}`)

    const email = normalizeEmail(payload.email)
    const courseId = getCourseIdByOfferId(payload.offer_id)
    if (!courseId) throw new Error(`Unknown offer_id: ${payload.offer_id}`)

    // Найти пользователя через profiles, не через listUsers()
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          getcourse_user_id: payload.getcourse_user_id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          name: payload.first_name ? `${payload.first_name} ${payload.last_name ?? ""}`.trim() : email.split("@")[0],
        },
      })
      if (error) throw error
      if (!data.user) throw new Error("User was not created")
      userId = data.user.id
    }

    // Upsert profile
    await supabase.from("profiles").upsert({
      id: userId,
      email,
      getcourse_user_id: payload.getcourse_user_id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone: payload.phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })

    // Upsert order
    await supabase.from("getcourse_orders").upsert({
      getcourse_order_id: payload.order_id,
      getcourse_user_id: payload.getcourse_user_id,
      email,
      offer_id: payload.offer_id,
      product_title: payload.product_title,
      status: "paid",
      paid_at: payload.paid_at ?? new Date().toISOString(),
      raw_payload: payload,
    }, { onConflict: "getcourse_order_id" })

    // Upsert enrollment
    await supabase.from("enrollments").upsert({
      user_id: userId,
      course_id: courseId,
      getcourse_order_id: payload.order_id,
      status: "active",
      starts_at: new Date().toISOString(),
    }, { onConflict: "user_id,course_id" })

    // Отправить magic link через generateLink (серверный метод)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })
    if (linkError) throw linkError

    // TODO: отправить linkData.properties.action_link через Resend
    // Пока логируем
    console.log("Magic link generated for", email, linkData.properties.action_link)

    if (eventLog?.id) {
      await supabase.from("webhook_events").update({
        processed_at: new Date().toISOString(),
      }).eq("id", eventLog.id)
    }

    return NextResponse.json({ ok: true, user_id: userId, course_id: courseId })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (eventLog?.id) {
      await supabase.from("webhook_events").update({ error: message }).eq("id", eventLog.id)
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
