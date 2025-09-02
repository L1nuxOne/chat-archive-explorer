import Dexie, { Table } from 'dexie';

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

  constructor() {
    super('chat-archive');
    this.version(1).stores({
      conversations: 'id, created_at, model, msg_count, token_est, title',
      messages: '++pk, conversation_id, idx, role, created_at',
      tags: '++id, name',
      conversation_tags: '++id, conversation_id, tag_id',
    });
  }
}

export const db = new ChatArchiveDB();
