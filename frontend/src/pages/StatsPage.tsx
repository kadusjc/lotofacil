import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import type { StatsSummary } from '../api/types'
import { ErrorBox, Loading } from '../components/Feedback'
import { formatDate, formatInt, formatPct, pad2 } from '../lib/format'
import { useGame } from '../lib/games'

type Metric = 'frequencyPct' | 'recentFrequency' | 'delay'
const METRICS: Record<Metric, string> = {
  frequencyPct: 'Frequência histórica',
  recentFrequency: 'Saídas recentes',
  delay: 'Atraso atual (concursos)',
}
const PROFILES: Array<[keyof StatsSummary['profiles'], string]> = [
  ['sum', 'Soma das dezenas'],
  ['odds', 'Quantidade de ímpares'],
  ['primes', 'Quantidade de primos'],
  ['frame', 'Dezenas na moldura'],
  ['repeats', 'Repetidas do concurso anterior'],
]

export function StatsPage() {
  const game = useGame()
  const [metric, setMetric] = useState<Metric>('frequencyPct')
  const { data, error, isLoading } = useQuery({ queryKey: [game.id, 'summary'], queryFn: () => api.summary(game.id) })
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />

  const p = game.drawn / game.totalNumbers
  const chartData = data.numbers.map((n) => ({ name: pad2(n.number), value: n[metric] }))
  const expected = metric === 'frequencyPct' ? p : metric === 'recentFrequency' ? data.recentWindow * p : undefined

  return (
    <section className="stack">
      <div className="kpis">
        <Kpi label="Concursos analisados" value={formatInt(data.totalDraws)} />
        <Kpi label="Período" value={`${formatDate(data.first.date)} – ${formatDate(data.last.date)}`} />
        <Kpi label="Soma típica (p10–p90)" value={`${Math.round(data.profiles.sum.p10)}–${Math.round(data.profiles.sum.p90)}`} />
        <Kpi
          label="Teste qui-quadrado"
          value={data.uniformity.isUniform ? 'Sorteio uniforme' : 'Desvio detectado'}
          hint={`p = ${data.uniformity.pValue.toFixed(3)}`}
        />
      </div>

      <div className="panel">
        <div className="row between wrap">
          <h3>Dezenas</h3>
          <div className="row wrap" role="tablist">
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <button key={m} role="tab" aria-selected={metric === m} className={`chip${metric === m ? ' active' : ''}`} onClick={() => setMetric(m)}>
                {m === 'recentFrequency' ? `Saídas nos últimos ${data.recentWindow}` : METRICS[m]}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} interval={game.totalNumbers > 30 ? 'preserveStartEnd' : 0} />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              domain={metric === 'frequencyPct' ? [Math.floor(p * 80) / 100, 'auto'] : [0, 'auto']}
              tickFormatter={(v: number) => (metric === 'frequencyPct' ? formatPct(v, 0) : String(v))}
            />
            <Tooltip
              formatter={(v) => (metric === 'frequencyPct' ? formatPct(Number(v), 2) : String(v))}
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            />
            {expected !== undefined && <ReferenceLine y={expected} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'esperado', fill: 'var(--muted)', fontSize: 11 }} />}
            <Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="muted small">
          A linha tracejada é o valor esperado num sorteio perfeitamente aleatório (cada dezena sai em {(p * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% dos concursos).
        </p>
      </div>

      <div className="profile-grid">
        {PROFILES.map(([key, label]) => (
          <div className="panel" key={key}>
            <h4>{label}</h4>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.profiles[key].distribution} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="value" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v: number) => formatPct(v, 0)} dataKey="pct" />
                <Tooltip formatter={(v) => formatPct(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                <Bar dataKey="pct" fill="var(--accent-2)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="muted small">
              Mediana {data.profiles[key].p50.toFixed(0)} · 80% entre {Math.floor(data.profiles[key].p10)} e {Math.ceil(data.profiles[key].p90)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel kpi">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}
