import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateCertificatePDF } from '@/lib/certificate-pdf'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certNumber: string }> }
) {
  const { certNumber } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const certNum = parseInt(certNumber, 10)
  if (isNaN(certNum)) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data: cert } = await admin
    .from('certificates')
    .select('name, cert_number, issued_at, user_id')
    .eq('cert_number', certNum)
    .maybeSingle()

  if (!cert || cert.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let pdf: Buffer
  try {
    pdf = await generateCertificatePDF(cert.name, cert.cert_number, cert.issued_at)
  } catch (e) {
    console.error('[certificate] PDF generation failed:', e)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="INCF-certificate-${certNum}.pdf"`,
    },
  })
}
