/// <reference lib="webworker" />
import Dexie from 'dexie';

// Minimal DB hookup for worker reads only
interface MessageRow { pk?: number; conversation_id: string; idx: number; role: 'user'|'assistant'; created_at: number; text: string; model?: string }
interface ConversationRow { id: string; created_at: number; model: string; title: string }

class WorkerDB extends Dexie {
  messages!: Dexie.Table<MessageRow, number>;
  conversations!: Dexie.Table<ConversationRow, string>;
  constructor() {
    super('chat-archive');
    this.version(2).stores({
      conversations: 'id, created_at, model, msg_count, token_est, title',
      messages: '++pk, conversation_id, idx, role, created_at',
    });
  }
}

const wdb = new WorkerDB();

type InMsg =
  | { type: 'buildAll' }
  | { type: 'updateSince'; since: number } // seconds
  | { type: 'hourWeekday'; fromSec: number; toSec: number };

type OutMsg = {
  type: 'result';
  since: number;
  daily: { day: string; model: string; chats: number; user_msgs: number; asst_msgs: number; user_chars: number; asst_chars: number }[];
  monthly: { month: string; model: string; chats: number; user_msgs: number; asst_msgs: number; user_chars: number; asst_chars: number }[];
  chatStats: { conversation_id: string; replies: number; user_chars: number; asst_chars: number; first_ts: number; last_ts: number }[];
};

function toDay(tsSec: number) {
  const d = new Date(tsSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function toMonth(tsSec: number) {
  const d = new Date(tsSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function buildAll(): Promise<OutMsg> {
  const [msgs, convs] = await Promise.all([
    wdb.messages.toArray(),
    wdb.conversations.toArray(),
  ]);
  return await foldAggregates(msgs, convs, 0);
}

async function updateSince(since: number): Promise<OutMsg> {
  const msgs = await wdb.messages.where('created_at').aboveOrEqual(since).toArray();
  // We still need conversations for titles/models and chat stats bounds
  const convs = await wdb.conversations.toArray();
  return await foldAggregates(msgs, convs, since);
}

async function foldAggregates(msgs: MessageRow[], _convs: ConversationRow[], since: number): Promise<OutMsg> {
  const modelKey = '';
  const dailyMap = new Map<string, { chats: Set<string>; user_msgs: number; asst_msgs: number; user_chars: number; asst_chars: number }>();
  const monthlyMap = new Map<string, { chats: Set<string>; user_msgs: number; asst_msgs: number; user_chars: number; asst_chars: number }>();

  // Track affected conversations (for chat_stats re-computation)
  const affectedConvs = new Set<string>(msgs.map(m => m.conversation_id));

  for (const m of msgs) {
    const day = toDay(m.created_at);
    const month = toMonth(m.created_at);
    const chars = (m.text || '').length;
    // daily
    let d = dailyMap.get(day);
    if (!d) { d = { chats: new Set(), user_msgs: 0, asst_msgs: 0, user_chars: 0, asst_chars: 0 }; dailyMap.set(day, d); }
    d.chats.add(m.conversation_id);
    if (m.role === 'user') { d.user_msgs++; d.user_chars += chars; } else if (m.role === 'assistant') { d.asst_msgs++; d.asst_chars += chars; }
    // monthly
    let mo = monthlyMap.get(month);
    if (!mo) { mo = { chats: new Set(), user_msgs: 0, asst_msgs: 0, user_chars: 0, asst_chars: 0 }; monthlyMap.set(month, mo); }
    mo.chats.add(m.conversation_id);
    if (m.role === 'user') { mo.user_msgs++; mo.user_chars += chars; } else if (m.role === 'assistant') { mo.asst_msgs++; mo.asst_chars += chars; }
  }

  const daily = Array.from(dailyMap.entries()).map(([day, v]) => ({ day, model: modelKey, chats: v.chats.size, user_msgs: v.user_msgs, asst_msgs: v.asst_msgs, user_chars: v.user_chars, asst_chars: v.asst_chars }));
  const monthly = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, model: modelKey, chats: v.chats.size, user_msgs: v.user_msgs, asst_msgs: v.asst_msgs, user_chars: v.user_chars, asst_chars: v.asst_chars }));

  // Chat stats: recompute for affected convs (full-history to avoid drift)
  const chatStats: OutMsg['chatStats'] = [];
  for (const cid of affectedConvs) {
    const allMsgs = await wdb.messages.where('conversation_id').equals(cid).toArray();
    let first = Number.POSITIVE_INFINITY;
    let last = 0;
    let replies = 0;
    let userChars = 0;
    let asstChars = 0;
    if (allMsgs.length === 0) continue;
    for (const m of allMsgs) {
      if (m.role === 'assistant') replies++;
      const chars = (m.text || '').length;
      if (m.role === 'user') userChars += chars; else if (m.role === 'assistant') asstChars += chars;
      if (m.created_at < first) first = m.created_at;
      if (m.created_at > last) last = m.created_at;
    }
    chatStats.push({ conversation_id: cid, replies, user_chars: userChars, asst_chars: asstChars, first_ts: isFinite(first) ? first : 0, last_ts: last });
  }

  return { type: 'result', since, daily, monthly, chatStats };
}

async function buildHourWeekday(fromSec: number, toSec: number) {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const msgs = await wdb.messages.where('created_at').between(fromSec, toSec, true, true).toArray();
  for (const m of msgs) {
    const d = new Date(m.created_at * 1000);
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour] += 1;
  }
  let max = 0;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 24; c++) max = Math.max(max, grid[r][c]);
  return { grid, max };
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  (async () => {
    if (msg.type === 'buildAll') {
      const out = await buildAll();
      (self as any).postMessage(out);
    } else if (msg.type === 'updateSince') {
      const out = await updateSince(msg.since);
      (self as any).postMessage(out);
    } else if (msg.type === 'hourWeekday') {
      const out = await buildHourWeekday(msg.fromSec, msg.toSec);
      (self as any).postMessage({ type: 'hourWeekdayResult', ...out });
    }
  })().catch(err => {
    (self as any).postMessage({ type: 'error', error: String(err) });
  });
};

export {};
