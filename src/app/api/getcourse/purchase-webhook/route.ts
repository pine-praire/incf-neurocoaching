import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { GetCoursePurchasePayload } from "@/lib/getcourse/types"
import { getCourseIdByOfferId, getCourseIdByProductId } from "@/lib/getcourse/access-map"
import { sendMagicLinkEmail } from "@/lib/brevo"

export const runtime = "nodejs"

class WebhookValidationError extends Error {}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}


export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()

  const secretFromHeader = request.headers.get("x-getcourse-secret")
  const secretFromQuery = new URL(request.url).searchParams.get("secret")
  const incomingSecret = secretFromHeader ?? secretFromQuery ?? ''
  const expectedSecret = process.env.GETCOURSE_WEBHOOK_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 })
  }

  const a = Buffer.from(incomingSecret, 'utf8')
  const b = Buffer.from(expectedSecret, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: GetCoursePurchasePayload
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      payload = await request.json()
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      payload = {
        event_type: params.get("event_type") ?? undefined,
        getcourse_user_id: params.get("getcourse_user_id") ?? undefined,
        email: params.get("email") ?? undefined,
        first_name: params.get("first_name") ?? undefined,
        last_name: params.get("last_name") ?? undefined,
        phone: params.get("phone") ?? undefined,
        order_id: params.get("order_id") ?? undefined,
        offer_id: params.get("offer_id") ?? undefined,
        product_id: params.get("product_id") ?? undefined,
        product_title: params.get("product_title") ?? undefined,
        payment_status: params.get("payment_status") ?? undefined,
        paid_at: params.get("paid_at") ?? undefined,
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
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
    if (!payload.email) throw new WebhookValidationError("Missing email")
    if (!payload.order_id) throw new WebhookValidationError("Missing order_id")

    const email = normalizeEmail(payload.email)
    const courseId =
      (payload.offer_id ? getCourseIdByOfferId(payload.offer_id) : null) ??
      (payload.product_id ? getCourseIdByProductId(payload.product_id) : null)
    if (!courseId) throw new WebhookValidationError(`Unknown offer_id/product_id: ${payload.offer_id ?? payload.product_id}`)

    // Idempotency: skip if this order_id was already processed successfully
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_key', `purchase:${payload.order_id}`)
      .is('error', null)
      .not('processed_at', 'is', null)
      .maybeSingle()

    if (existingEvent) {
      return NextResponse.json({ ok: true })
    }

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
      offer_id: payload.offer_id ?? null,
      getcourse_product_id: payload.product_id ?? null,
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
    let magicLink = ''
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
    } catch (linkErr) {
      console.error('generateLink failed:', linkErr)
    }

    if (magicLink) {
      try {
        await sendMagicLinkEmail(email, magicLink)
      } catch (emailError) {
        // Логируем, но не роняем вебхук — GetCourse не должен получать 500
        console.error('Failed to send magic link email:', emailError)
      }
    }

    if (eventLog?.id) {
      await supabase.from("webhook_events").update({
        processed_at: new Date().toISOString(),
      }).eq("id", eventLog.id)
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    const isValidation = error instanceof WebhookValidationError
    const message = isValidation && error instanceof Error ? error.message : "Webhook processing failed"
    if (!isValidation) console.error('Unexpected purchase webhook error:', error)
    if (eventLog?.id) {
      await supabase.from("webhook_events").update({ error: message }).eq("id", eventLog.id)
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
