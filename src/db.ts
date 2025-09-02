import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface Conversation {
  id: string;
  created_at: number;
  model: string;
  msg_count: number;
  token_est: number;
  title: string;
}

export interface Message {
  pk?: number;
  conversation_id: string;
  idx: number;
  role: 'user' | 'assistant';
  created_at: number;
  text: string;
  model?: string;
}

export interface Tag {
  id?: number;
  name: string;
}

export interface ConversationTag {
  id?: number;
  conversation_id: string;
  tag_id: number;
}

export class ChatArchiveDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, number>;
  tags!: Table<Tag, number>;
  conversation_tags!: Table<ConversationTag, number>;
  agg_daily!: Table<AggDaily, [string, string]>; // [day+model]
  agg_monthly!: Table<AggMonthly, [string, string]>; // [month+model]
  chat_stats!: Table<ChatStats, string>; // conversation_id key

  constructor() {
    super('chat-archive');
    this.version(1).stores({
      conversations: 'id, created_at, model, msg_count, token_est, title',
      messages: '++pk, conversation_id, idx, role, created_at',
      tags: '++id, name',
      conversation_tags: '++id, conversation_id, tag_id',
    });
    this.version(2).stores({
      conversations: 'id, created_at, model, msg_count, token_est, title',
      messages: '++pk, conversation_id, idx, role, created_at',
      tags: '++id, name',
      conversation_tags: '++id, conversation_id, tag_id',
      agg_daily: '[day+model], day, chats, user_msgs, asst_msgs, user_chars, asst_chars',
      agg_monthly: '[month+model], month, chats, user_msgs, asst_msgs, user_chars, asst_chars',
      chat_stats: 'conversation_id, replies, user_chars, asst_chars, first_ts, last_ts',
    });
  }
}

export const db = new ChatArchiveDB();

// Aggregate types
export interface AggDaily {
  day: string; // YYYY-MM-DD
  model: string; // optional dimension; use '' for all
  chats: number;
  user_msgs: number;
  asst_msgs: number;
  user_chars: number;
  asst_chars: number;
}

export interface AggMonthly {
  month: string; // YYYY-MM
  model: string; // optional dimension; use '' for all
  chats: number;
  user_msgs: number;
  asst_msgs: number;
  user_chars: number;
  asst_chars: number;
}

export interface ChatStats {
  conversation_id: string;
  replies: number; // assistant messages
  user_chars: number;
  asst_chars: number;
  first_ts: number; // seconds
  last_ts: number;  // seconds
}
