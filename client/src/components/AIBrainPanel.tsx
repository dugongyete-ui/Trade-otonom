import { useState, useEffect } from 'react';

interface TradeMemory {
  no: number;
  waktu: string;
  simbol: string;
  aksi: string;
  hasil: 'WIN' | 'LOSS';
  pnl: string;
  strategi: string;
  entry: string | number;
  sl: string | number;
  tp: string | number;
  close: string | number;
}

interface AIBrain {
  rules?: string[];
  best_setups?: string[];
  avoid_conditions?: string[];
  indicator_preferences?: Record<string, string>;
  risk_notes?: string[];
  trade_memory?: TradeMemory[];
  win_count?: number;
  loss_count?: number;
  total_pnl?: string | number;
  evolution_count?: number;
}

interface EvolutionLog {
  id: number;
  trade_id?: number;
  trade_outcome: 'TP_HIT' | 'SL_HIT';
  change_summary: string;
  created_at: string;
  trade_action?: string;
  trade_symbol?: string;
  trade_pnl?: string | number;
}

interface StrategyRule {
  id: number;
  rule_text: string;
  rule_category: 'rule' | 'setup' | 'avoid' | 'risk';
  times_applied: number;
  success_count: number;
  fail_count: number;
  success_rate: number;
  first_seen_at: string;
  last_updated_at: string;
  is_active: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--gold)', marginBottom: 6, marginTop: 14 }}>
      {children}
    </div>
  );
}

function RuleItem({ text, type }: { text: string; type: 'rule' | 'good' | 'bad' | 'risk' | 'indicator' }) {
  const color = type === 'good' ? 'var(--green)' : type === 'bad' ? 'var(--red)' : type === 'risk' ? 'var(--gold)' : 'var(--text-2)';
  const icon  = type === 'good' ? '✅' : type === 'bad' ? '🚫' : type === 'risk' ? '⚠️' : type === 'indicator' ? '📊' : '📌';
  return (
    <div style={{ display: 'flex', gap: 7, padding: '5px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 11, color, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function MemoryRow({ m }: { m: TradeMemory }) {
  const isWin = m.hasil === 'WIN';
  const pnl = parseFloat(m.pnl);
  const time = m.waktu ? new Date(m.waktu).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  return (
    <div data-testid={`row-memory-${m.no}`} style={{
      display: 'grid', gridTemplateColumns: '28px 60px auto 1fr 80px', gap: 6,
      padding: '6px 8px', borderRadius: 6, alignItems: 'center',
      background: isWin ? 'rgba(0,214,143,.04)' : 'rgba(245,54,92,.04)',
      border: `1px solid ${isWin ? 'rgba(0,214,143,.12)' : 'rgba(245,54,92,.12)'}`,
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700 }}>#{m.no}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: isWin ? 'var(--green)' : 'var(--red)', padding: '2px 5px', borderRadius: 4, background: isWin ? 'rgba(0,214,143,.12)' : 'rgba(245,54,92,.12)', textAlign: 'center' as const }}>
        {m.hasil} {m.aksi}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{m.strategi}</span>
      <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{time}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: pnl >= 0 ? 'var(--green)' : 'var(--red)', textAlign: 'right' as const }} className="mono">
        {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toLocaleString()}
      </span>
    </div>
  );
}

function EvolutionItem({ log }: { log: EvolutionLog }) {
  const isWin = log.trade_outcome === 'TP_HIT';
  const time = new Date(log.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div data-testid={`card-evolution-${log.id}`} style={{
      padding: '8px 10px', borderRadius: 8, marginBottom: 6,
      borderLeft: `3px solid ${isWin ? 'var(--green)' : 'var(--red)'}`,
      background: 'var(--bg-card-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: isWin ? 'var(--green)' : 'var(--red)' }}>
          {isWin ? '✅ WIN' : '❌ LOSS'} — {log.trade_action || ''} {log.trade_symbol || ''}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{time}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{log.change_summary}</p>
    </div>
  );
}

function RulePerformanceRow({ rule }: { rule: StrategyRule }) {
  const rate = parseFloat(String(rule.success_rate));
  const rateColor = rate >= 0.65 ? 'var(--green)' : rate >= 0.45 ? 'var(--gold)' : 'var(--red)';
  const catIcon = rule.rule_category === 'setup' ? '✅' : rule.rule_category === 'avoid' ? '🚫' : rule.rule_category === 'risk' ? '⚠️' : '📌';
  const barWidth = `${Math.round(rate * 100)}%`;

  return (
    <div data-testid={`card-rule-${rule.id}`} style={{
      padding: '8px 10px', borderRadius: 8, marginBottom: 5,
      background: 'var(--bg-card-2)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{catIcon}</span>
        <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, flex: 1 }}>{rule.rule_text}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: barWidth, height: '100%', background: rateColor, borderRadius: 2, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
            <span style={{ color: 'var(--text-2)', fontWeight: 700 }}>{rule.times_applied}×</span> dipakai
          </span>
          <span style={{ fontSize: 9, color: 'var(--green)' }}>{rule.success_count}W</span>
          <span style={{ fontSize: 9, color: 'var(--red)' }}>{rule.fail_count}L</span>
          <span className="mono" style={{ fontSize: 10, fontWeight: 800, color: rateColor }}>{Math.round(rate * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '20px 0', textAlign: 'center' as const, color: 'var(--text-3)', fontSize: 11 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      {text}
    </div>
  );
}

export function AIBrainPanel({ lastEvolution }: { lastEvolution?: { summary: string; timestamp: string } | null }) {
  const [brain, setBrain] = useState<AIBrain | null>(null);
  const [logs, setLogs] = useState<EvolutionLog[]>([]);
  const [rules, setRules] = useState<StrategyRule[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<'strategi' | 'performa' | 'memori' | 'evolusi'>('strategi');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [brainRes, logsRes, rulesRes] = await Promise.all([
        fetch('/api/ai-brain').then(r => r.json()),
        fetch('/api/strategy-evolution-log').then(r => r.json()),
        fetch('/api/strategy-rules').then(r => r.json()),
      ]);
      setBrain(brainRes.brain);
      setUpdatedAt(brainRes.updatedAt);
      setLogs(Array.isArray(logsRes) ? logsRes : []);
      setRules(Array.isArray(rulesRes) ? rulesRes : []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (lastEvolution) fetchData();
  }, [lastEvolution]);

  const winCount  = brain?.win_count  || 0;
  const lossCount = brain?.loss_count || 0;
  const totalTrades = winCount + lossCount;
  const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(0) : '—';
  const totalPnl = parseFloat(String(brain?.total_pnl || 0));
  const evolCount = brain?.evolution_count || 0;

  const TABS = [
    { key: 'strategi', label: 'Strategi' },
    { key: 'performa', label: `Performa (${rules.length})` },
    { key: 'memori',   label: `Memori (${brain?.trade_memory?.length || 0})` },
    { key: 'evolusi',  label: `Evolusi (${logs.length})` },
  ] as const;

  return (
    <div className="card" style={{ padding: '14px 14px 16px' }} data-testid="panel-ai-brain">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', letterSpacing: '.02em' }}>OTAK AI — Strategi Aktif</div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>
              {evolCount > 0 ? `${evolCount} evolusi` : 'Belum ada evolusi'}
              {updatedAt ? ` · Update: ${new Date(updatedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--text-3)', background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
            🔒 AI-only
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 12 }}>
        {[
          { label: 'Win', value: String(winCount), color: 'var(--green)' },
          { label: 'Loss', value: String(lossCount), color: 'var(--red)' },
          { label: 'Win Rate', value: totalTrades > 0 ? `${winRate}%` : '—', color: parseFloat(winRate) >= 50 ? 'var(--green)' : 'var(--gold)' },
          { label: 'Total PnL', value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString()}`, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Last evolution alert */}
      {lastEvolution && (
        <div style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.25)', borderRadius: 7, padding: '7px 10px', marginBottom: 10, fontSize: 11, color: 'var(--gold)', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 700 }}>🔄 Baru diperbarui: </span>{lastEvolution.summary}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 12, flexWrap: 'wrap' as const }}>
        {TABS.map(t => (
          <button
            key={t.key}
            data-testid={`btn-brain-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, minWidth: 60, padding: '5px 4px', borderRadius: 6, fontSize: 9.5, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '.02em',
              background: tab === t.key ? 'var(--gold-glow)' : 'transparent',
              border: `1px solid ${tab === t.key ? 'rgba(201,168,76,.3)' : 'var(--border)'}`,
              color: tab === t.key ? 'var(--gold)' : 'var(--text-3)',
              transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' as const, color: 'var(--text-3)', fontSize: 11 }}>Memuat data otak AI...</div>
      ) : !brain ? (
        <EmptyState icon="🌱" text="AI belum memiliki strategi. Menunggu trade pertama ditutup untuk mulai belajar." />
      ) : (
        <>
          {/* TAB: STRATEGI */}
          {tab === 'strategi' && (
            <div>
              {(!brain.rules?.length && !brain.best_setups?.length && !brain.avoid_conditions?.length) ? (
                <EmptyState icon="🔬" text="Strategi sedang dalam proses pembentukan. AI akan memperbarui setelah trade pertama ditutup." />
              ) : (
                <>
                  {brain.rules && brain.rules.length > 0 && (
                    <>
                      <SectionTitle>📌 Aturan Strategi</SectionTitle>
                      {brain.rules.map((r, i) => <RuleItem key={i} text={r} type="rule" />)}
                    </>
                  )}
                  {brain.best_setups && brain.best_setups.length > 0 && (
                    <>
                      <SectionTitle>✅ Setup Terbukti Profit</SectionTitle>
                      {brain.best_setups.map((r, i) => <RuleItem key={i} text={r} type="good" />)}
                    </>
                  )}
                  {brain.avoid_conditions && brain.avoid_conditions.length > 0 && (
                    <>
                      <SectionTitle>🚫 Kondisi yang Dihindari</SectionTitle>
                      {brain.avoid_conditions.map((r, i) => <RuleItem key={i} text={r} type="bad" />)}
                    </>
                  )}
                  {brain.indicator_preferences && Object.keys(brain.indicator_preferences).length > 0 && (
                    <>
                      <SectionTitle>📊 Preferensi Indikator</SectionTitle>
                      {Object.entries(brain.indicator_preferences).map(([k, v], i) => (
                        <RuleItem key={i} text={`${k}: ${v}`} type="indicator" />
                      ))}
                    </>
                  )}
                  {brain.risk_notes && brain.risk_notes.length > 0 && (
                    <>
                      <SectionTitle>⚠️ Catatan Manajemen Risiko</SectionTitle>
                      {brain.risk_notes.map((r, i) => <RuleItem key={i} text={r} type="risk" />)}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB: PERFORMA ATURAN */}
          {tab === 'performa' && (
            <div>
              {rules.length === 0 ? (
                <EmptyState icon="📈" text="Belum ada data performa aturan. Data akan muncul setelah trade pertama ditutup dan AI berevolusi." />
              ) : (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
                    Setiap aturan yang pernah ditulis AI dilacak kinerjanya secara individual — berapa kali dipakai, berapa yang menang, dan win rate historisnya.
                  </div>
                  {(['rule', 'setup', 'avoid', 'risk'] as const).map(cat => {
                    const catRules = rules.filter(r => r.rule_category === cat);
                    if (catRules.length === 0) return null;
                    const catLabel = cat === 'rule' ? '📌 Aturan Strategi' : cat === 'setup' ? '✅ Setup Profit' : cat === 'avoid' ? '🚫 Kondisi Dihindari' : '⚠️ Manajemen Risiko';
                    return (
                      <div key={cat}>
                        <SectionTitle>{catLabel}</SectionTitle>
                        {catRules.map(r => <RulePerformanceRow key={r.id} rule={r} />)}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* TAB: MEMORI TRADE */}
          {tab === 'memori' && (
            <div>
              {!brain.trade_memory?.length ? (
                <EmptyState icon="📝" text="Belum ada memori trade. AI akan mencatat setiap win dan loss beserta alasannya." />
              ) : (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>
                    Menampilkan {brain.trade_memory.length} trade terakhir yang diingat AI
                  </div>
                  {[...brain.trade_memory].reverse().map(m => <MemoryRow key={m.no} m={m} />)}
                </>
              )}
            </div>
          )}

          {/* TAB: EVOLUSI */}
          {tab === 'evolusi' && (
            <div>
              {logs.length === 0 ? (
                <EmptyState icon="🧬" text="Belum ada catatan evolusi. AI akan belajar dan berevolusi setelah setiap trade ditutup." />
              ) : (
                logs.map(log => <EvolutionItem key={log.id} log={log} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
