import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureInitialAggregates, getChatStats, queryAgg, rebuildSince, getLastAggCutoffSec } from '../analytics/api';
import { hourWeekday } from '../analytics/buckets';

type Props = { onOpenConversation: (id: string) => void };

function fmtDate(tsSec: number) {
  const d = new Date(tsSec * 1000);
  return d.toLocaleString();
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function parseYmd(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor(new Date(y, (m || 1) - 1, d || 1).getTime() / 1000);
}

export default function Analytics({ onOpenConversation }: Props) {
  const now = new Date();
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return ymd(d);
  }, []);
  const [gran, setGran] = useState<'day' | 'month'>('day');
  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(ymd(now));
  const [rows, setRows] = useState<any[]>([]);
  const [chatRows, setChatRows] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<'replies' | 'user_chars' | 'asst_chars' | 'first_ts' | 'last_ts' | 'title'>('replies');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const barsRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; html: string; show: boolean }>({ x: 0, y: 0, html: '', show: false });
  const lastKeyRef = useRef<string | null>(null);
  const [heat, setHeat] = useState<{ grid: number[][]; max: number }>({ grid: Array.from({ length: 7 }, () => Array(24).fill(0)), max: 1 });

  useEffect(() => {
    ensureInitialAggregates();
  }, []);

  useEffect(() => {
    const fromSec = parseYmd(from);
    const toSec = parseYmd(to);
    queryAgg({ fromSec, toSec, granularity: gran }).then(setRows);
    getChatStats().then(setChatRows);
    hourWeekday(fromSec, toSec).then(setHeat).catch(() => {});
  }, [from, to, gran]);

  const totals = useMemo(() => {
    let chats = 0, user_msgs = 0, asst_msgs = 0, user_chars = 0, asst_chars = 0;
    for (const r of rows) {
      chats += r.chats || 0;
      user_msgs += r.user_msgs || 0;
      asst_msgs += r.asst_msgs || 0;
      user_chars += r.user_chars || 0;
      asst_chars += r.asst_chars || 0;
    }
    return { chats, user_msgs, asst_msgs, user_chars, asst_chars };
  }, [rows]);

  const bars = useMemo(() => {
    const items = rows.map((r: any) => ({
      key: r.day || r.month,
      chats: r.chats || 0,
      user_msgs: r.user_msgs || 0,
      asst_msgs: r.asst_msgs || 0,
      user_chars: r.user_chars || 0,
      asst_chars: r.asst_chars || 0,
      totalMsgs: (r.user_msgs || 0) + (r.asst_msgs || 0),
    }));
    const maxVal = Math.max(1, ...items.map(i => i.totalMsgs));
    return items.map(i => ({ ...i, h: Math.round((i.totalMsgs / maxVal) * 100) }));
  }, [rows]);

  const sortedChatRows = useMemo(() => {
    const arr = [...chatRows];
    arr.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === 'title') { av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [chatRows, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(() => key);
    setSortDir(d => (sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'desc'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div>
          <label style={{display:'flex', gap:6, alignItems:'center'}}>
            <span>From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
        </div>
        <div>
          <label style={{display:'flex', gap:6, alignItems:'center'}}>
            <span>To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
        </div>
        <div>
          <label style={{display:'flex', gap:6, alignItems:'center'}}>
            <span>Granularity</span>
            <select value={gran} onChange={e => setGran(e.target.value as any)}>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
          </label>
        </div>
        <div style={{marginLeft: 'auto'}}>
          <button onClick={async () => { const since = await getLastAggCutoffSec(); await rebuildSince(since); const fromSec = parseYmd(from); const toSec = parseYmd(to); setRows(await queryAgg({ fromSec, toSec, granularity: gran })); setChatRows(await getChatStats()); }}>Rebuild since last</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <div className="card"><div className="card-k">Chats</div><div className="card-v">{totals.chats}</div></div>
        <div className="card"><div className="card-k">User msgs</div><div className="card-v">{totals.user_msgs}</div></div>
        <div className="card"><div className="card-k">Asst msgs</div><div className="card-v">{totals.asst_msgs}</div></div>
        <div className="card"><div className="card-k">User chars</div><div className="card-v">{totals.user_chars}</div></div>
        <div className="card"><div className="card-k">Asst chars</div><div className="card-v">{totals.asst_chars}</div></div>
      </div>

      <div>
        <div style={{ fontSize: 12, opacity: .8, marginBottom: 6 }}>Timeline ({gran}) — height = total messages</div>
        <div className="bars" ref={barsRef} onMouseMove={(e)=>{ if(!tooltip.show) return; const rect = barsRef.current?.getBoundingClientRect(); const x = e.clientX - (rect?.left||0) + 10; const y = e.clientY - (rect?.top||0) - 10; setTooltip(t=>({ ...t, x, y })); }} onMouseLeave={()=>setTooltip(t=>({ ...t, show:false }))}>
          {bars.map(b => (
            <div
              key={b.key}
              className="bar"
              style={{ height: `${b.h}%` }}
              onMouseEnter={(e)=>{ const rect = barsRef.current?.getBoundingClientRect(); const x = e.clientX - (rect?.left||0) + 10; const y = e.clientY - (rect?.top||0) - 10; const html = `<div><b>${b.key}</b></div><div>chats: ${b.chats}</div><div>user: ${b.user_msgs}</div><div>asst: ${b.asst_msgs}</div><div>chars: ${b.user_chars + b.asst_chars}</div>`; setTooltip({ x, y, html, show:true }); }}
              onClick={(e)=>{ const last = lastKeyRef.current; const key = b.key as string; if (e.shiftKey && last) { const a = key < last ? key : last; const c = key > last ? key : last; if (gran==='day') { setFrom(a); setTo(c); } else { const [ya, ma] = a.split('-').map(Number); const [yc, mc] = c.split('-').map(Number); const fa = `${ya}-${String(ma).padStart(2,'0')}-01`; const lc = new Date(yc, (mc||1), 0).getDate(); const tl = `${yc}-${String(mc).padStart(2,'0')}-${String(lc).padStart(2,'0')}`; setFrom(fa); setTo(tl); } } else { if (gran==='day') { setFrom(key); setTo(key); } else { const [y, m] = key.split('-').map(Number); const first = `${y}-${String(m).padStart(2,'0')}-01`; const lastd = new Date(y, (m||1), 0).getDate(); const last = `${y}-${String(m).padStart(2,'0')}-${String(lastd).padStart(2,'0')}`; setFrom(first); setTo(last); } lastKeyRef.current = key; } }}
            />
          ))}
          {tooltip.show && (
            <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }} dangerouslySetInnerHTML={{ __html: tooltip.html }} />
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, opacity: .8, margin: '12px 0 6px' }}>Hour × Weekday</div>
        <div className="heat" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
          {Array.from({ length: 7 }).map((_, day) => (
            <div key={day} className="heat-row" style={{ display:'contents' }}>
              {Array.from({ length: 24 }).map((__, hour) => {
                const v = heat.grid[day]?.[hour] || 0;
                const pct = heat.max ? Math.round((v / heat.max) * 80) + 10 : 0;
                return (
                  <div key={hour}
                    className="cell"
                    title={`Day ${day}, ${hour}:00 — count: ${v}`}
                    style={{ background: `color-mix(in oklab, var(--accent) ${pct}%, transparent)` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, opacity: .8, margin: '12px 0 6px' }}>Per‑chat stats</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('title')}>Title</th>
                <th onClick={() => toggleSort('replies')}>Replies</th>
                <th onClick={() => toggleSort('user_chars')}>User chars</th>
                <th onClick={() => toggleSort('asst_chars')}>Asst chars</th>
                <th onClick={() => toggleSort('first_ts')}>First</th>
                <th onClick={() => toggleSort('last_ts')}>Last</th>
              </tr>
            </thead>
            <tbody>
              {sortedChatRows.map((r) => (
                <tr key={r.conversation_id} onClick={() => onOpenConversation(r.conversation_id)} className="row-click">
                  <td>{r.title || 'Untitled'}</td>
                  <td>{r.replies}</td>
                  <td>{r.user_chars}</td>
                  <td>{r.asst_chars}</td>
                  <td>{fmtDate(r.first_ts)}</td>
                  <td>{fmtDate(r.last_ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
