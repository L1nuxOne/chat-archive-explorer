import { describe, expect, it } from 'vitest';
import { flattenMapping, MappingNode } from './flatten';

describe('flattenMapping', () => {
  it('ignores system and tool messages and flattens text', () => {
    const mapping: Record<string, MappingNode> = {
      root: { id: 'root', parent: null, children: ['1'] },
      '1': {
        id: '1', parent: 'root', children: ['2', '3', '4'],
        message: { author: { role: 'system' }, content: { parts: ['sys'] } }
      },
      '2': {
        id: '2', parent: '1', children: [],
        message: { author: { role: 'user' }, content: { parts: ['hello'] }, create_time: 1 }
      },
      '3': {
        id: '3', parent: '1', children: [],
        message: { author: { role: 'assistant' }, content: { parts: ['world'] }, create_time: 2, metadata: { model: 'gpt' } }
      },
      '4': {
        id: '4', parent: '1', children: [],
        message: { author: { role: 'tool' }, content: { parts: ['tool'] }, create_time: 3 }
      },
    };

    const res = flattenMapping(mapping);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ role: 'user', text: 'hello', created_at: 1 });
    expect(res[1]).toMatchObject({ role: 'assistant', text: 'world', created_at: 2, model: 'gpt' });
  });

  it('skips empty parts', () => {
    const mapping: Record<string, MappingNode> = {
      root: { id: 'root', parent: null, children: ['1', '2'] },
      '1': {
        id: '1', parent: 'root', children: [],
        message: { author: { role: 'user' }, content: { parts: [] }, create_time: 1 }
      },
      '2': {
        id: '2', parent: 'root', children: [],
        message: { author: { role: 'assistant' }, content: { parts: [{ text: '' }, { text: 'ok' }] }, create_time: 2 }
      }
    };

    const res = flattenMapping(mapping);
    expect(res).toHaveLength(1);
    expect(res[0].text).toBe('ok');
  });
});
