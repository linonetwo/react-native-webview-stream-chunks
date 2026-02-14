# react-native-webview-stream-chunks

Stream large payloads into a React Native WebView by chunking, inject them as `<script>` tags, and optionally re-execute scripts — through a high-level sender API.

## Features

- High-level sender (`WebViewStreamSender`) instead of manual low-level events.
- Per-injection script options on `finalizePayload(options)`.
- Supports injecting multiple different script tags in one session.
- Optional script re-execution (`all` via default selector, or specific selector).

## Install

```bash
npm install react-native-webview-stream-chunks
# or
pnpm add react-native-webview-stream-chunks
```

## Quick Start

### 1) Generate the preload script (receiver side)

```ts
import { createWebViewStreamChunksPreloadScript } from 'react-native-webview-stream-chunks';

const preloadScript = createWebViewStreamChunksPreloadScript({
  receiverReadyCallbackPath: 'window.onReady', // Optional
});
```

Inject `preloadScript` into your WebView (for example with `injectedJavaScript`).

### 2) Send data from React Native (sender side)

```ts
import { WebViewStreamSender } from 'react-native-webview-stream-chunks';

const sender = new WebViewStreamSender((type, data) => {
  const message = JSON.stringify({ type, data });
  webViewRef.current?.injectJavaScript(`window.onStreamChunksToWebView(${message});`);
});

sender.checkReceiverReady();
sender.setContent(skeletonHtml);

for (const chunk of chunks) {
  sender.appendChunk(chunk);
}

sender.finalizePayload({
  scriptType: 'application/json',
  scriptClassName: 'my-payload-store',
  scriptTagName: 'main-store',
  anchorSelector: '#styleArea',
});

sender.reexecuteScripts();
// sender.reexecuteScripts('script[data-boot]');
```

### 3) Inject multiple script tags

```ts
// First payload
for (const chunk of firstChunks) sender.appendChunk(chunk);
sender.finalizePayload({
  scriptType: 'application/json',
  scriptClassName: 'store-a',
  scriptTagName: 'users',
  anchorSelector: '#styleArea',
});

// Second payload
for (const chunk of secondChunks) sender.appendChunk(chunk);
sender.finalizePayload({
  scriptType: 'text/javascript',
  scriptClassName: 'boot-script',
  scriptTagName: 'runtime',
  anchorSelector: '#styleArea',
});
```

## API

### `WebViewStreamSender`

| Method                        | Description                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `checkReceiverReady()`        | Ping receiver and trigger its configured ready callback path.           |
| `setContent(html)`            | Replace `document.body.innerHTML` and reset buffered chunks.            |
| `appendChunk(chunk)`          | Append one payload chunk to the receiver buffer.                        |
| `finalizePayload(options?)`   | Join buffered chunks and inject one `<script>` with per-call options.   |
| `reexecuteScripts(selector?)` | Re-execute matching script tags by clone-replace. Defaults to `script`. |

### `finalizePayload(options)`

| Option            | Default                  | Description                                                                     |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `scriptType`      | `application/json`       | `type` attribute of injected `<script>`.                                        |
| `scriptClassName` | `webview-stream-payload` | Class used for this payload script (also used to exclude it from re-execution). |
| `scriptTagName`   | `default-payload`        | Extra class/name tag for easier identification.                                 |
| `anchorSelector`  | `#styleArea`             | Inject payload script after this element.                                       |

### Preload options

| Option                      | Default | Description                                                        |
| --------------------------- | ------- | ------------------------------------------------------------------ |
| `receiverReadyCallbackPath` | `''`    | (Optional) Dot-path on `window` invoked by `checkReceiverReady()`. |
