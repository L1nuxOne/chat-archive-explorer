# Chat Archive Explorer

A lightweight viewer for exported ChatGPT conversations. Import your ZIP export and browse chats locally.

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

Drag and drop the ZIP (or conversation JSON files) onto the app. Conversations are parsed and stored in the browser using IndexedDB via Dexie.

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
