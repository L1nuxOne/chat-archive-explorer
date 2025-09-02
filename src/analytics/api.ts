import { db, type AggDaily, type AggMonthly, type ChatStats } from '../db';

let worker: Worker | null = null;

function ensureWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  return worker!;
}

export function getAnalyticsWorker() {
  return ensureWorker();
}

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
function dayToSec(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(new Date(y, (m || 1) - 1, d || 1).getTime() / 1000);
}

export async function getLastAggCutoffSec(): Promise<number> {
  const last = await db.agg_daily.orderBy('day').last();
  if (!last) return 0;
  return dayToSec(last.day);
}

type WorkerResult = {
  type: 'result';
  since: number;
  daily: AggDaily[];
  monthly: AggMonthly[];
  chatStats: ChatStats[];
}

export async function rebuildSince(sinceSec: number): Promise<void> {
  const w = ensureWorker();
  const payload = sinceSec > 0 ? { type: 'updateSince', since: sinceSec } : { type: 'buildAll' as const };
  const result: WorkerResult = await new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as WorkerResult | { type: 'error'; error: string };
      if (data && (data as any).type === 'result') {
        w.removeEventListener('message', onMsg as any);
        resolve(data as WorkerResult);
      } else if ((data as any).type === 'error') {
        w.removeEventListener('message', onMsg as any);
        reject(new Error((data as any).error));
      }
    };
    w.addEventListener('message', onMsg as any);
    // @ts-ignore
    w.postMessage(payload);
  });

  const sinceDay = toDay(result.since || 0);
  const sinceMonth = toMonth(result.since || 0);

  await db.transaction('rw', db.agg_daily, db.agg_monthly, db.chat_stats, async () => {
    if (result.since === 0) {
      await db.agg_daily.clear();
      await db.agg_monthly.clear();
      await db.chat_stats.clear();
    } else {
      await db.agg_daily.where('day').aboveOrEqual(sinceDay).delete();
      await db.agg_monthly.where('month').aboveOrEqual(sinceMonth).delete();
      const ids = result.chatStats.map(c => c.conversation_id);
      if (ids.length) {
        await db.chat_stats.where('conversation_id').anyOf(ids).delete();
      }
    }
    if (result.daily.length) await db.agg_daily.bulkPut(result.daily);
    if (result.monthly.length) await db.agg_monthly.bulkPut(result.monthly);
    if (result.chatStats.length) await db.chat_stats.bulkPut(result.chatStats);
  });
}

export async function ensureInitialAggregates(): Promise<void> {
  const anyDaily = await db.agg_daily.limit(1).toArray();
  if (anyDaily.length === 0) {
    await rebuildSince(0);
  }
}

export async function queryAgg(params: { fromSec: number; toSec: number; granularity: 'day' | 'month' }) {
  const { fromSec, toSec, granularity } = params;
  if (granularity === 'day') {
    const fromKey = toDay(fromSec);
    const toKey = toDay(toSec);
    return await db.agg_daily.where('day').between(fromKey, toKey, true, true).sortBy('day');
  } else {
    const fromKey = toMonth(fromSec);
    const toKey = toMonth(toSec);
    return await db.agg_monthly.where('month').between(fromKey, toKey, true, true).sortBy('month');
  }
}

export async function getChatStats(): Promise<(ChatStats & { title?: string })[]> {
  const stats = await db.chat_stats.toArray();
  const ids = stats.map(s => s.conversation_id);
  const convs = await db.conversations.where('id').anyOf(ids).toArray();
  const map = new Map(convs.map(c => [c.id, c.title] as const));
  return stats.map(s => ({ ...s, title: map.get(s.conversation_id) }));
}
