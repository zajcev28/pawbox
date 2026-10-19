import { fmtPLN, tierPerks, type BoxPricing } from '../lib/pricing'

// Status boxa z paskiem postępu do kolejnego poziomu
export default function TierStatus({ pricing, compact = false }: { pricing: BoxPricing; compact?: boolean }) {
  const { tier, nextTier, monthlyValue, missingMonthly } = pricing
  const progress = nextTier ? Math.min(100, Math.round(monthlyValue / nextTier.minMonthly * 100)) : 100

  return (
    <div style={{ background: '#f0f7f3', border: '1px solid #d9ede2', borderRadius: '0.9rem', padding: compact ? '0.75rem' : '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: compact ? '1.5rem' : '1.9rem' }}>{tier.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status boxa</div>
          <div style={{ fontFamily: 'Lora,Georgia,serif', fontWeight: 700, fontSize: compact ? '1rem' : '1.15rem', color: '#144830' }}>{tier.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#1b5c3a' }}>{tierPerks(tier)}</div>
        </div>
      </div>

      <div style={{ height: 8, background: '#d9ede2', borderRadius: 4, overflow: 'hidden', margin: '0.7rem 0 0.4rem' }}
        role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#1b5c3a', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>

      <div style={{ fontSize: '0.75rem', color: '#374151' }}>
        {nextTier
          ? <>Brakuje <strong>{fmtPLN(missingMonthly)}</strong> miesięcznie do statusu {nextTier.emoji} <strong>{nextTier.name}</strong> ({tierPerks(nextTier)}).</>
          : <>Najwyższy status — dziękujemy, że jesteś z nami! 💚</>}
      </div>
    </div>
  )
}
