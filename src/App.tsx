import { useEffect, useRef, useState } from 'react';
import { importArchive } from './importer';
import { db, Conversation, Message } from './db';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import 'highlight.js/styles/github.css';
import './App.css';
import { exportConversation } from './exporter';

function App() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const listParent = useRef<HTMLDivElement>(null);
  const listVirtual = useVirtualizer({
    count: convs.length,
    getScrollElement: () => listParent.current,
    estimateSize: () => 48,
  });

  useEffect(() => {
    db.conversations.toArray().then(setConvs);
  }, []);

  const handleFiles = async (files: FileList) => {
    for (const f of Array.from(files)) {
      await importArchive(f);
    }
    setConvs(await db.conversations.toArray());
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
  };

  return (
    <div className="app" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <header>
        <input type="file" multiple onChange={e => e.target.files && handleFiles(e.target.files)} />
      </header>
      <div className="body">
        <div className="sidebar" ref={listParent}>
          <div style={{ height: `${listVirtual.getTotalSize()}px`, position: 'relative' }}>
            {listVirtual.getVirtualItems().map(v => {
              const c = convs[v.index];
              return (
                <div
                  key={c.id}
                  className="conv-row"
                  style={{ position: 'absolute', top: 0, left: 0, transform: `translateY(${v.start}px)`, height: `${v.size}px` }}
                  onClick={() => openConversation(c.id)}
                >
                  <div className="title">{c.title}</div>
                  <div className="meta">{new Date(c.created_at * 1000).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="preview">
          {selected && (
            <button onClick={() => exportConversation(selected)}>Export</button>
          )}
          {messages.map(m => (
            <div key={m.idx} className={`msg ${m.role}`}>
              <div
                dangerouslySetInnerHTML={{
                  __html: marked(m.text, {
                    highlight: (code, lang) => {
                      try {
                        return hljs.highlight(code, { language: lang || 'plaintext' }).value;
                      } catch {
                        return hljs.highlightAuto(code).value;
                      }
                    },
                  }),
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
