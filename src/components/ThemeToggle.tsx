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
        <button key={opt}
          onClick={() => setSetting(opt)}
          title={opt}
          style={{
            border:'1px solid var(--border)', borderRadius:8, padding:'2px 8px',
            background: setting===opt ? 'var(--btnActive)' : 'transparent',
            color:'var(--fg)', cursor:'pointer'
          }}>
          {opt}
        </button>
      ))}
      <span style={{opacity:.6, marginLeft:6}}>(→ {effective})</span>
    </div>
  );
}
