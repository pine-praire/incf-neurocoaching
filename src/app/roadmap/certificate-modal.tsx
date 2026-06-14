'use client'

interface Props {
  certNumber: number
  name: string
  issuedAt: string
  emailSent?: boolean
  onClose: () => void
}

export function CertificateModal({ certNumber, name, issuedAt, emailSent, onClose }: Props) {
  const date = new Date(issuedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ваш сертификат"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,18,16,.6)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
      >
        {/* Dark header */}
        <div style={{ background: 'linear-gradient(135deg, #1c2233 0%, #2a3048 100%)', padding: '28px 32px 22px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: '#c96442', display: 'inline-grid', placeItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>i</span>
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c96442', fontWeight: 700, marginBottom: 4 }}>INCF</div>
          <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>Введение в нейрокоучинг</div>
        </div>

        {/* Orange banner */}
        <div style={{ background: '#c96442', padding: '13px 32px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>🎓 Сертификат получен!</p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px 28px' }}>
          <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--ink)', lineHeight: 1.65 }}>
            Поздравляем, <strong>{name}</strong>!<br />
            Вы успешно прошли курс и получаете официальный сертификат INCF.
          </p>

          {/* Cert number */}
          <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>Номер сертификата</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', fontFamily: 'monospace', letterSpacing: 1 }}>{certNumber}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>{date}</div>
          </div>

          {emailSent === false ? (
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'oklch(0.45 0.12 40)', lineHeight: 1.6 }}>
              ⚠ Не удалось отправить PDF на почту. Скачайте сертификат по кнопке ниже.
            </p>
          ) : (
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Копия в формате PDF отправлена на вашу почту.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href={`/api/certificate/${certNumber}`}
              download
              style={{ display: 'block', background: '#c96442', color: '#fff', textDecoration: 'none', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)', textAlign: 'center', boxShadow: '0 6px 16px -6px rgba(180,80,50,.5)' }}
            >
              ⬇ Скачать PDF
            </a>
            <button
              onClick={onClose}
              style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
