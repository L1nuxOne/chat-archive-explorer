export interface MappingNode {
  id: string;
  parent?: string | null;
  children?: string[];
  message?: {
    author?: { role?: string };
    content?: any;
    create_time?: number;
    model?: string;
    metadata?: { model?: string };
  };
}

export interface FlatMessage {
  role: 'user' | 'assistant';
  text: string;
  created_at: number;
  model?: string;
}

export function flattenMapping(mapping: Record<string, MappingNode>): FlatMessage[] {
  const root = Object.values(mapping).find(n => n.parent == null);
  const ordered: FlatMessage[] = [];
  const visited = new Set<string>();

  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = mapping[id];
    if (!node) return;
    const msg = node.message;
    if (msg && msg.author && ['user', 'assistant'].includes(msg.author.role ?? '')) {
      const parts: string[] = [];
      const content = msg.content as any;
      if (Array.isArray(content?.parts)) {
        for (const p of content.parts) {
          if (typeof p === 'string') parts.push(p);
          else if (p && typeof p.text === 'string') parts.push(p.text);
        }
      } else if (typeof content === 'string') {
        parts.push(content);
      } else if (content?.text) {
        parts.push(content.text);
      }
      const text = parts.join('\n').trim();
      if (text) {
        ordered.push({
          role: msg.author.role as 'user' | 'assistant',
          text,
          created_at: msg.create_time ?? Date.now(),
          model: msg.model ?? msg.metadata?.model,
        });
      }
    }
    for (const child of node.children ?? []) {
      dfs(child);
    }
  }

  if (root) dfs(root.id); else Object.keys(mapping).forEach(dfs);

  return ordered.sort((a, b) => a.created_at - b.created_at);
}
