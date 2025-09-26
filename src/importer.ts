import { unzipSync, strFromU8 } from 'fflate';
import { db } from './db';
import { flattenMapping } from './utils/flatten';

interface ConversationJSON {
  id: string;
  title?: string;
  create_time?: number;
  model?: string;
  mapping: Record<string, any>;
}

export async function importArchive(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    const u8 = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(u8);
    for (const [path, data] of Object.entries(entries)) {
      if (path === 'conversations.json' || path.startsWith('conversations/')) {
        const text = strFromU8(data as Uint8Array);
        const json = JSON.parse(text);
        const list: ConversationJSON[] = Array.isArray(json) ? json : [json];
        for (const conv of list) {
          await saveConversation(conv);
        }
      }
    }
  } else if (name.endsWith('.json')) {
    const text = await file.text();
    const json = JSON.parse(text);
    const list: ConversationJSON[] = Array.isArray(json) ? json : [json];
    for (const conv of list) {
      await saveConversation(conv);
    }
  } else {
    throw new Error('Unsupported file type');
  }
}

async function saveConversation(conv: ConversationJSON) {
  const messages = flattenMapping(conv.mapping || {});
  const msg_count = messages.length;
  const token_est = messages
    .filter(m => m.role === 'assistant')
    .reduce((acc, m) => acc + Math.round(m.text.length / 4), 0);

  await db.transaction('rw', [db.conversations, db.messages], async () => {
    await db.conversations.put({
      id: conv.id,
      title: conv.title || 'Untitled',
      created_at: conv.create_time || Date.now(),
      model: conv.model || '',
      msg_count,
      token_est,
    });

    await db.messages.where('conversation_id').equals(conv.id).delete();

    if (messages.length) {
      await db.messages.bulkAdd(
        messages.map((m, idx) => ({
          conversation_id: conv.id,
          idx,
          role: m.role,
          created_at: m.created_at,
          text: m.text,
          model: m.model,
        }))
      );
    }
  });
}
