import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCourseIdByOfferId, getCourseIdByProductId } from '@/lib/getcourse/access-map'
import { grantCourseAccess } from '@/lib/getcourse/grant-access'

export const runtime = 'nodejs'

class WebhookValidationError extends Error {}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient()

  const secretFromHeader = request.headers.get('x-getcourse-secret')
  const secretFromQuery = new URL(request.url).searchParams.get('secret')
  const incomingSecret = secretFromHeader ?? secretFromQuery ?? ''
  const expectedSecret = process.env.GETCOURSE_WEBHOOK_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 })
  }

  const a = Buffer.from(incomingSecret, 'utf8')
  const b = Buffer.from(expectedSecret, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, string | undefined>
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      payload = await request.json()
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      payload = {
        event_type:        params.get('event_type')        ?? undefined,
        email:             params.get('email')             ?? undefined,
        offer_id:          params.get('offer_id')          ?? undefined,
        product_id:        params.get('product_id')        ?? undefined,
        order_id:          params.get('order_id')          ?? undefined,
        getcourse_user_id: params.get('getcourse_user_id') ?? undefined,
        first_name:        params.get('first_name')        ?? undefined,
        last_name:         params.get('last_name')         ?? undefined,
        phone:             params.get('phone')             ?? undefined,
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = payload.email ? normalizeEmail(payload.email) : undefined
  const courseId =
    (payload.offer_id ? getCourseIdByOfferId(payload.offer_id) : null) ??
    (payload.product_id ? getCourseIdByProductId(payload.product_id) : null)

  const eventKey = payload.order_id
    ? `access:${payload.order_id}`
    : email && courseId
      ? `access_email:${email}:${courseId}`
      : undefined

  const { data: eventLog } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'getcourse',
      event_type: 'access_granted',
      event_key: eventKey,
      payload,
    })
    .select('id')
    .single()

  try {
    if (!email) throw new WebhookValidationError('Missing email')
    if (!courseId) throw new WebhookValidationError(`Unknown offer_id/product_id: ${payload.offer_id ?? payload.product_id}`)

    if (eventKey) {
      const { data: existingEvent } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('event_key', eventKey)
        .is('error', null)
        .not('processed_at', 'is', null)
        .maybeSingle()

      if (existingEvent) {
        return NextResponse.json({ ok: true })
      }
    }

    await grantCourseAccess(supabase, {
      email,
      courseId,
      getcourseOrderId: payload.order_id,
      getcourseUserId: payload.getcourse_user_id,
      firstName: payload.first_name,
      lastName: payload.last_name,
      phone: payload.phone,
    })

    if (eventLog?.id) {
      await supabase.from('webhook_events').update({
        processed_at: new Date().toISOString(),
      }).eq('id', eventLog.id)
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    const isValidation = error instanceof WebhookValidationError
    const message = isValidation && error instanceof Error ? error.message : 'Webhook processing failed'
    if (!isValidation) console.error('Unexpected access webhook error:', error)
    if (eventLog?.id) {
      await supabase.from('webhook_events').update({ error: message }).eq('id', eventLog.id)
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
