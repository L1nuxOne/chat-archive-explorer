# Chat Archive Explorer

A lightweight viewer for exported ChatGPT conversations. Import your ZIP export and browse chats locally.

## Features

- Theme: Light / Dark / System with persistence and OS tracking
- Fast virtualized sidebar list with two‑line clamp and safe ellipsis
- Independent scrolling panes (sidebar vs preview)
- Sort conversations by Date/Title (Asc/Desc)
- Markdown rendering with syntax highlighting
- Export a conversation to a single file
- Analytics (worker‑backed):
  - Day/Month timeline of chats/messages/characters
  - Hover tooltip with exact counts; click a bar to filter to that bucket (Shift+Click to select a range)
  - Per‑chat stats table (replies, char totals), sortable
  - Hour × Weekday heatmap of message volume
  - Incremental aggregates after new imports

## Development

```bash
npm install
npm run dev
```

## Exporting from ChatGPT

1. In ChatGPT, open **Settings → Data Controls**.
2. Click **Export data** and wait for the e‑mail.
3. Download the ZIP file and save it locally.

## Importing

Drag and drop the ZIP (or conversation JSON files) onto the app. Conversations are parsed and stored in the browser using IndexedDB via Dexie. Aggregates are computed in a Web Worker and cached for fast Analytics.

## Limitations

- Only user and assistant messages are imported.
- Attachments are ignored.
- Token counts are rough estimates.

## Resetting the database

Open the browser console and run:

```js
indexedDB.deleteDatabase('chat-archive');
```

Reload the page afterwards.

## Sample data

A tiny sample is available in `conversations.sample.json` for testing the importer.
