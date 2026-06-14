import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getCourseIdByOfferId } from "@/lib/getcourse/access-map"

export const runtime = "nodejs"

class WebhookValidationError extends Error {}

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()

  const secretFromHeader = request.headers.get("x-getcourse-secret")
  const expectedSecret = process.env.GETCOURSE_WEBHOOK_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 })
  }

  const a = Buffer.from(secretFromHeader ?? '', 'utf8')
  const b = Buffer.from(expectedSecret, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  let payload: Record<string, string | undefined>

  try {
    if (contentType.includes('application/json')) {
      payload = await request.json()
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      payload = {
        event_type:        params.get('event_type')        ?? undefined,
        getcourse_user_id: params.get('getcourse_user_id') ?? undefined,
        email:             params.get('email')             ?? undefined,
        order_id:          params.get('order_id')          ?? undefined,
        offer_id:          params.get('offer_id')          ?? undefined,
        payment_status:    params.get('payment_status')    ?? undefined,
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { data: eventLog } = await supabase
    .from("webhook_events")
    .insert({
      provider: "getcourse",
      event_type: "purchase_cancelled",
      event_key: payload.order_id ? `cancel:${payload.order_id}` : undefined,
      payload,
    })
    .select("id")
    .single()

  try {
    if (!payload.order_id) throw new WebhookValidationError("Missing order_id")
    if (!payload.offer_id) throw new WebhookValidationError("Missing offer_id")

    const courseId = getCourseIdByOfferId(payload.offer_id)
    if (!courseId) throw new WebhookValidationError(`Unknown offer_id: ${payload.offer_id}`)

    // Idempotency: skip if this order was already cancelled successfully
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_key', `cancel:${payload.order_id}`)
      .is('error', null)
      .not('processed_at', 'is', null)
      .maybeSingle()

    if (existingEvent) {
      return NextResponse.json({ ok: true })
    }

    const { error: orderErr } = await supabase.from("getcourse_orders").update({
      status: "cancelled",
      raw_payload: payload,
    }).eq("getcourse_order_id", payload.order_id)
    if (orderErr) throw orderErr

    const { error: enrollErr } = await supabase.from("enrollments").update({
      status: "revoked",
    }).eq("getcourse_order_id", payload.order_id).eq("course_id", courseId)
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
    if (!isValidation) console.error('Unexpected cancel webhook error:', error)
    if (eventLog?.id) {
      await supabase.from("webhook_events").update({ error: message }).eq("id", eventLog.id)
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
