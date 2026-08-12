export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '48px 40px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 40, margin: '0 0 12px' }}>📊</p>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
            Analytics Dashboard
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Klompjes intern gebruik</p>
        </div>

        <form method="POST" action="/api/auth/login">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Wachtwoord
            </label>
            <input
              type="password"
              name="password"
              autoFocus
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 15,
                outline: 'none',
                color: '#111827',
              }}
              placeholder="••••••••"
            />
            {error && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>
                Onjuist wachtwoord. Probeer opnieuw.
              </p>
            )}
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              background: '#1e3a5f',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Inloggen
          </button>
        </form>
      </div>
    </div>
  )
}
