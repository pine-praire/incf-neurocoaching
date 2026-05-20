export default function DebugYoutube() {
  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700 }}>
      <h1 style={{ marginBottom: 8 }}>YouTube embed debug</h1>
      <p style={{ marginBottom: 20, color: '#666', fontSize: 14 }}>
        Bare iframe — no modal, no overlay, no CSS wrappers.
        If this works but /roadmap does not, the issue is in the modal component.
        If this also fails, the issue is in server headers / referrer policy.
      </p>
      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#111' }}>
        <iframe
          src="https://www.youtube.com/embed/gP7CY4szUbg"
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
        Check DevTools → Network → find youtube.com/embed request → verify Referer header is present.
      </p>
    </main>
  )
}
