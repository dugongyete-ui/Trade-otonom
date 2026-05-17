import { useEffect, useState } from 'react';

export interface ToastItem {
  id: number;
  type: 'tp' | 'sl';
  title: string;
  body: string;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  const isTP = toast.type === 'tp';
  const borderColor = isTP ? 'rgba(0,214,143,.35)' : 'rgba(245,54,92,.35)';
  const bgColor = isTP ? 'rgba(0,214,143,.08)' : 'rgba(245,54,92,.08)';
  const accentColor = isTP ? 'var(--green)' : 'var(--red)';
  const icon = isTP ? '✓' : '✗';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', borderRadius: 12,
        background: `var(--bg-card)`,
        border: `1px solid ${borderColor}`,
        boxShadow: `0 4px 24px rgba(0,0,0,.5), inset 0 0 0 1px ${bgColor}`,
        minWidth: 240, maxWidth: 300,
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(.96)',
        opacity: visible ? 1 : 0,
        transition: 'all .28s cubic-bezier(.2,.8,.4,1)',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: isTP ? 'var(--green-d)' : 'var(--red-d)',
        border: `1px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: accentColor,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, marginBottom: 2 }}>
          {toast.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {toast.body}
        </div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 14, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
