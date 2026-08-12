export default async function UitschrijvenPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '48px 40px', maxWidth: 440, textAlign: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        {success ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Uitgeschreven</h1>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Je bent succesvol afgemeld. Je ontvangt geen e-mails meer van ons.
            </p>
          </>
        ) : error === 'invalid' ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Ongeldige link</h1>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Deze uitschrijflink is niet geldig of al gebruikt. Neem contact op als je je wilt afmelden.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Er ging iets mis</h1>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Probeer het later opnieuw of neem contact op via klompjes.com.
            </p>
          </>
        )}
        <a href="https://klompjes.com" style={{ display: 'inline-block', marginTop: 24, color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>
          ← Terug naar Klompjes
        </a>
      </div>
    </div>
  )
}
