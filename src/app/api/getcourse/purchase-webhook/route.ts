import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { GetCoursePurchasePayload } from "@/lib/getcourse/types"
import { getCourseIdByOfferId, getCourseIdByProductId } from "@/lib/getcourse/access-map"
import { generateTempPassword } from "@/lib/auth-utils"

export const runtime = "nodejs"

const PAID_STATUSES = new Set(['Завершен', 'paid'])

class WebhookValidationError extends Error {}

// When createUser fails with "already registered" it means the auth user was
// created by a previous webhook run that then failed on the profiles upsert.
// The JS SDK has no getUserByEmail — we hit the GoTrue admin REST API directly.
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
    if (payload.payment_status && !PAID_STATUSES.has(payload.payment_status)) {
      if (eventLog?.id) {
        await supabase.from("webhook_events").update({
          processed_at: new Date().toISOString(),
          error: `skipped:unpaid_status:${payload.payment_status}`,
        }).eq("id", eventLog.id)
      }
      return NextResponse.json({ ok: true })
    }

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
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: generateTempPassword(),
        email_confirm: true,
        user_metadata: {
          getcourse_user_id: payload.getcourse_user_id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          name: payload.first_name ? `${payload.first_name} ${payload.last_name ?? ""}`.trim() : email.split("@")[0],
        },
      })

      if (!createError) {
        if (!createData.user) throw new Error("User was not created")
        userId = createData.user.id
      } else {
        // Auth user may already exist from a prior run that failed after createUser
        // but before the profiles upsert completed. Look them up via GoTrue REST API.
        const existingAuthId = await lookupAuthUserByEmail(email)
        if (!existingAuthId) throw createError
        userId = existingAuthId
      }
    }

    // Upsert profile
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: userId,
      email,
      getcourse_user_id: payload.getcourse_user_id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone: payload.phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    if (profileErr) throw profileErr

    // Upsert order
    const { error: orderErr } = await supabase.from("getcourse_orders").upsert({
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
    if (orderErr) throw orderErr

    // Upsert enrollment
    const { error: enrollErr } = await supabase.from("enrollments").upsert({
      user_id: userId,
      course_id: courseId,
      getcourse_order_id: payload.order_id,
      status: "active",
      starts_at: new Date().toISOString(),
    }, { onConflict: "user_id,course_id" })
    if (enrollErr) throw enrollErr

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
