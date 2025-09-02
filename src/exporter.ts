import { db } from './db';

export async function exportConversation(id: string) {
  const conv = await db.conversations.get(id);
  if (!conv) return;
  const msgs = await db.messages.where('conversation_id').equals(id).sortBy('idx');
  const front = `---\ntitle: ${conv.title}\ndate: ${new Date(conv.created_at * 1000).toISOString()}\nmodel: ${conv.model}\n---\n\n`;
  const body = msgs
    .map(m => `### ${m.role}\n\n${m.text}\n`)
    .join('\n');
  const blob = new Blob([front + body], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${conv.title || 'chat'}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
