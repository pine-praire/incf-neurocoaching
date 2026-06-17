import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LESSONS, FINALS } from '@/lib/course-data'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: progressRows } = await supabase
    .from('progress')
    .select('step_id')
    .eq('user_id', user.id)

  const { data: certificate } = await supabase
    .from('certificates')
    .select('cert_number, issued_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const completedLessons = (progressRows ?? []).filter(
    p => LESSONS.some(l => l.id === p.step_id) || FINALS.some(f => f.id === p.step_id)
  ).length
  const totalLessons = LESSONS.length + FINALS.length

  const displayName: string =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Участник'

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()

  const pct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div style={{
      background: '#ece9e2',
      minHeight: '100vh',
      padding: '20px 14px 56px',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Nav */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '13px 20px',
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--terra-2)', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, flexShrink: 0,
          }}>i</div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.55, color: 'var(--ink)' }}>INCF · Курс</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Введение в нейрокоучинг</div>
          </div>
          <a href="/roadmap" style={{
            marginLeft: 'auto', fontSize: 12.5, fontWeight: 600,
            color: 'var(--ink-soft)', textDecoration: 'none',
            padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 8,
          }}>← Карта</a>
        </div>

        {/* Profile card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--line)', boxShadow: 'var(--shadow-md)',
          padding: '24px', display: 'flex', flexDirection: 'column', gap: 20,
        }}>

          {/* Avatar + identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 999, flexShrink: 0,
              background: 'var(--terra-soft)', border: '2px solid var(--terra-2)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
              color: 'var(--terra-2)',
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', lineHeight: 1.2,
              }}>{displayName}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 3 }}>{user.email}</div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--line-soft)' }} />

          {/* Progress stat */}
          <div style={{
            background: 'var(--bg-deep)', borderRadius: 14,
            padding: '16px 18px', border: '1px solid var(--line-soft)',
          }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em',
              textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8,
            }}>Уроков пройдено</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700,
                color: 'var(--terra-2)',
              }}>{completedLessons}</span>
              <span style={{ fontSize: 14, color: 'var(--ink-mute)' }}>из {totalLessons}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'oklch(0.92 0.012 75)', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--terra-2), var(--gold-2))',
                borderRadius: 999,
              }} />
            </div>
          </div>

          {/* Certificate */}
          {certificate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: 0,
              }}>
                Сертификат № {certificate.cert_number} · {new Date(certificate.issued_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <iframe
                src={`/api/certificate/${certificate.cert_number}`}
                style={{ width: '100%', height: 480, borderRadius: 10, border: '1px solid var(--line)' }}
                title="Сертификат"
              />
              <a
                href={`/api/certificate/${certificate.cert_number}`}
                download
                style={{ fontSize: 13, color: 'var(--terra)', textUnderlineOffset: 2, textDecoration: 'none', fontWeight: 600 }}
              >
                Скачать PDF →
              </a>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/roadmap" style={{
              flex: 1, minWidth: 140,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: 'var(--terra-2)', color: '#fff', borderRadius: 10,
              padding: '10px 16px', fontWeight: 600, fontSize: 13,
              fontFamily: 'var(--font-body)', textDecoration: 'none',
              boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)',
            }}>
              Продолжить курс →
            </a>
            <form action={signOut}>
              <button type="submit" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', color: 'var(--ink-soft)',
                border: '1px solid var(--line)', padding: '9px 16px', borderRadius: 10,
                fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>
                Выйти
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
