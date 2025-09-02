import { getAnalyticsWorker } from './api';

export type HeatResult = { grid: number[][]; max: number };

export async function hourWeekday(fromSec: number, toSec: number): Promise<HeatResult> {
  const w = getAnalyticsWorker();
  return await new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as any;
      if (data && data.type === 'hourWeekdayResult') {
        w.removeEventListener('message', onMsg as any);
        resolve({ grid: data.grid, max: data.max });
      } else if (data && data.type === 'error') {
        w.removeEventListener('message', onMsg as any);
        reject(new Error(data.error));
      }
    };
    w.addEventListener('message', onMsg as any);
    // @ts-ignore
    w.postMessage({ type: 'hourWeekday', fromSec, toSec });
  });
}

