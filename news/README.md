# RSS News Ticker with Groq Assistant

A browser-based RSS dashboard with rule-based Arabic/English classification, duplicate detection, filters, a live ticker, and an optional Groq assistant for individual articles.

## Run locally

Requirements: Node.js `20.19+` or `22.12+`.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with:

```bash
npm run build
npm run preview
```

You can also open `index.html` directly from the project folder. `npm run dev` and `npm run build` refresh the standalone files in `assets/` automatically after source changes. To refresh only those files, run `npm run build:standalone`.

Run automated checks with:

```bash
npm test
```

## Use the AI assistant

1. Fetch or open saved RSS news.
2. Select the small AI control beside a headline.
3. On first use, paste a Groq API key (`gsk_...`) and choose **Test & save**.
4. The assistant reads the selected article metadata, generates a structured Arabic brief, and links source citations.
5. Ask follow-up questions by text or use push-to-talk. Voice questions receive spoken replies when the browser provides Arabic speech support.
6. Close the assistant to collapse it into the global AI floating button.

Saved analyses and conversations reopen without another API request. Use **Refresh from web** only when a new live analysis is needed.

Every Groq request includes fixed system rules that keep answers article-scoped, factual, resistant to instructions embedded in feed content, and written in fluent Arabic unless another language is requested. These rules are not editable from the UI.

## API key setup and security

- **Groq**: Create a free key at [Groq Console](https://console.groq.com/keys). The default model is `llama-3.3-70b-versatile`, with automatic fallback to `llama-3.1-8b-instant`.

The app follows a browser-local bring-your-own-key model:

- The key is stored in this device's IndexedDB.
- The key is sent directly to Groq via the `Authorization: Bearer` header.
- The key is never placed in application source, request URLs, rendered HTML, chat history, or logs.
- The page has no third-party runtime JavaScript and uses a restrictive Content Security Policy restricting connections to approved origins.

Browser storage is not equivalent to a hardware or server-side secret vault. Any code that compromises the same website origin could still use browser-held credentials. Do not use a key shared with sensitive production systems.

To remove the key, open **AI settings & privacy** and select **Delete API key**. AI history has separate per-article and global deletion controls.

## Model and free-tier limits

- **Groq**: If the selected model is unavailable or rate-limited, the app queries Groq's Models API and retries a compatible fallback. Model preferences can also be saved under **AI settings & privacy**.

## Voice behavior

Voice is push-to-talk and never starts automatically. Recognition uses the browser's Arabic speech-recognition support. Spoken answers use an available Arabic system voice. Before playback, URLs, Markdown, separators, slashes, and other non-speech symbols are removed while sentence boundaries become natural pauses. The written answer remains unchanged. Text input and visible answers remain available when microphone permission, speech recognition, or speech playback is unsupported.

## Local data

RSS articles and filters continue using the app's existing localStorage records. AI data uses a separate versioned IndexedDB database named `rss_ai_assistant_v1` with stores for:

- Groq key status and value
- Per-article analyses, citations, and messages
- Model and last-session preferences

Clearing RSS history does not delete the Groq key or AI history, and deleting the key does not silently remove saved AI conversations.
