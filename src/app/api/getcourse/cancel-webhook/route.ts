import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { GetCoursePurchasePayload } from "@/lib/getcourse/types"
import { getCourseIdByOfferId } from "@/lib/getcourse/access-map"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()

  const secretFromHeader = request.headers.get("x-getcourse-secret")
  const expectedSecret = process.env.GETCOURSE_WEBHOOK_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 })
  }

  if (secretFromHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: GetCoursePurchasePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
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
    if (!payload.order_id) throw new Error("Missing order_id")
    if (!payload.offer_id) throw new Error("Missing offer_id")

    const courseId = getCourseIdByOfferId(payload.offer_id)
    if (!courseId) throw new Error(`Unknown offer_id: ${payload.offer_id}`)

    await supabase.from("getcourse_orders").update({
      status: "cancelled",
      raw_payload: payload,
    }).eq("getcourse_order_id", payload.order_id)

    await supabase.from("enrollments").update({
      status: "revoked",
    }).eq("getcourse_order_id", payload.order_id).eq("course_id", courseId)

    if (eventLog?.id) {
      await supabase.from("webhook_events").update({
        processed_at: new Date().toISOString(),
      }).eq("id", eventLog.id)
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (eventLog?.id) {
      await supabase.from("webhook_events").update({ error: message }).eq("id", eventLog.id)
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
