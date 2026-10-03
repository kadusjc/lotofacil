export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}
    </p>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  )
}
