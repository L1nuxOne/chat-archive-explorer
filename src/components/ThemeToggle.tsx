import { useTheme } from '../theme/ThemeProvider';

export default function ThemeToggle() {
  const { setting, setSetting, effective } = useTheme();
  return (
    <div style={{
      display:'flex', gap:6, alignItems:'center', fontSize:12,
      background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:'4px 8px'
    }}>
      <span style={{opacity:.8}}>Theme</span>
      {(['light','dark','system'] as const).map(opt => (
        <button
          key={opt}
          type="button"
          className={`btn-ghost${setting === opt ? ' active' : ''}`}
          onClick={() => setSetting(opt)}
          title={opt}
        >
          {opt}
        </button>
      ))}
      <span style={{opacity:.6, marginLeft:6}}>(→ {effective})</span>
    </div>
  );
}
