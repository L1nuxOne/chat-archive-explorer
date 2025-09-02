import { useEffect, useMemo, useRef, useState } from 'react';
import { importArchive } from './importer';
import { db } from './db';
import type { Conversation, Message } from './db';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import ThemeToggle from './components/ThemeToggle';
import 'highlight.js/styles/github.css';
import './App.css';
import { exportConversation } from './exporter';
import Analytics from './views/Analytics';
import { getLastAggCutoffSec, rebuildSince } from './analytics/api';

function App() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'date' | 'title'>(() => 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => 'desc');
  const [view, setView] = useState<'explorer' | 'analytics'>('explorer');

  const listParent = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const sortedConvs = useMemo(() => {
    const arr = [...convs];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = (a.created_at ?? 0) - (b.created_at ?? 0);
      } else {
        const at = (a.title || '').trim();
        const bt = (b.title || '').trim();
        cmp = at.localeCompare(bt, undefined, { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [convs, sortKey, sortDir]);

  const listVirtual = useVirtualizer({
    count: sortedConvs.length,
    getScrollElement: () => listParent.current,
    estimateSize: () => 56, // 2-line clamp + paddings
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 6,
  });

  useEffect(() => {
    db.conversations.toArray().then(setConvs);
  }, []);

  const handleFiles = async (files: FileList) => {
    for (const f of Array.from(files)) {
      await importArchive(f);
    }
    setConvs(await db.conversations.toArray());
    // Incrementally update aggregates after import
    try {
      const since = await getLastAggCutoffSec();
      await rebuildSince(since);
    } catch (e) {
      // swallow errors in UI path
      console.error('aggregate update failed', e);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const openConversation = async (id: string) => {
    setSelected(id);
    const msgs = await db.messages.where('conversation_id').equals(id).sortBy('idx');
    setMessages(msgs);
    if (previewRef.current) previewRef.current.scrollTop = 0;
  };

  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = 0;
  }, [selected]);

  return (
    <div className="app" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:12}}>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <h1 style={{margin:0, fontSize:18}}>Chat Archive Explorer</h1>
          <nav style={{display:'flex', gap:8}}>
            <button onClick={() => setView('explorer')} style={{padding:'4px 8px', border:'1px solid var(--border)', background: view==='explorer'?'var(--btnActive)':'transparent'}}>Explorer</button>
            <button onClick={() => setView('analytics')} style={{padding:'4px 8px', border:'1px solid var(--border)', background: view==='analytics'?'var(--btnActive)':'transparent'}}>Analytics</button>
          </nav>
        </div>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <div style={{display:'flex', gap:6, alignItems:'center', fontSize:12}}>
            <label>
              <span style={{marginRight:4}}>Sort</span>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as 'date' | 'title')}>
                <option value="date">Date</option>
                <option value="title">Title</option>
              </select>
            </label>
            <label>
              <span style={{marginRight:4}}>Order</span>
              <select value={sortDir} onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}>
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </label>
          </div>
          <ThemeToggle />
          <input type="file" multiple onChange={e => e.target.files && handleFiles(e.target.files)} />
        </div>
      </header>
      <div className="body">
        {view === 'analytics' ? (
          <div style={{flex:1, overflow:'auto'}}>
            <Analytics onOpenConversation={openConversation} />
          </div>
        ) : (
        <>
        <div className="sidebar" ref={listParent}>
          <div className="conv-list" style={{ height: `${listVirtual.getTotalSize()}px`, position: 'relative' }}>
            {listVirtual.getVirtualItems().map(v => {
              const c = sortedConvs[v.index];
              return (
                <div
                  key={c.id}
                  data-index={v.index}
                  ref={listVirtual.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, transform: `translateY(${v.start}px)`, width: '100%' }}
                >
                  <div
                    className="conv-row"
                    onClick={() => openConversation(c.id)}
                  >
                    <div className="title">{c.title || 'Untitled'}</div>
                    <div className="meta">{new Date(c.created_at * 1000).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="preview" ref={previewRef}>
          {selected && (
            <button onClick={() => exportConversation(selected)}>Export</button>
          )}
          {messages.map(m => (
            <div key={m.idx} className={`msg ${m.role}`}>
              <div
                dangerouslySetInnerHTML={{
                  __html: marked.parse(m.text),
                }}
              />
            </div>
          ))}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default App;

// Configure syntax highlighting for marked once per module load
marked.use(markedHighlight({
  highlight(code: string, lang?: string) {
    try {
      return hljs.highlight(code, { language: lang || 'plaintext' }).value;
    } catch {
      return hljs.highlightAuto(code).value;
    }
  },
}));
