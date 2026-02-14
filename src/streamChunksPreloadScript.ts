/**
 * Internal event types for the sender–receiver protocol.
 * Prefer the high-level `WebViewStreamSender` API over using these directly.
 */
export const WebViewStreamEventTypes = {
  CHECK_RECEIVER_READY: 'CHECK_RECEIVER_READY',
  SET_CONTENT: 'SET_CONTENT',
  APPEND_CHUNK: 'APPEND_CHUNK',
  FINALIZE_PAYLOAD: 'FINALIZE_PAYLOAD',
  REEXECUTE_SCRIPTS: 'REEXECUTE_SCRIPTS',
} as const;

export type WebViewStreamEventType = (typeof WebViewStreamEventTypes)[keyof typeof WebViewStreamEventTypes];

export type WebViewStreamReceiverEvent = {
  type: WebViewStreamEventType;
  data?: string;
};

export interface WebViewStreamPreloadScriptOptions {
  /** Dot-separated path on `window` to call when CHECK_RECEIVER_READY fires, e.g. `'myService.onReady'` */
  receiverReadyCallbackPath?: string;
}

export interface PayloadScriptInjectionOptions {
  scriptType?: string;
  scriptClassName?: string;
  scriptTagName?: string;
  anchorSelector?: string;
}

interface WebViewStreamResolvedOptions {
  receiverReadyCallbackPath: string;
}

/**
  IMPORTANT: Hermes compatibility and code injection rationale

  We do NOT use function.toString() at runtime because Hermes (the JS engine used by React Native)
  serializes functions as [bytecode], which breaks code injection for WebView. For example, you may see:
  ```
    LOG  webviewSideReceiver (function webViewStreamReceiverIIFE(a0, a1) { [bytecode] })({"receiverReadyCallbackPath":"service.wikiHookService.setWebviewReceiverReady"}, {"CHECK_RECEIVER_READY":"CHECK_RECEIVER_READY","SET_CONTENT":"SET_CONTENT","APPEND_CHUNK":"APPEND_CHUNK","FINALIZE_PAYLOAD":"FINALIZE_PAYLOAD","REEXECUTE_SCRIPTS":"REEXECUTE_SCRIPTS"});
  ```
  Instead, we compile the receiver function to JS at build time and inject it as a string into the final bundle.
  See scripts/injectReceiver.mjs for details. The placeholder below is replaced in dist/streamChunksPreloadScript.js after tsc build.
*/
const webViewStreamReceiverIIFECode = '__WEBVIEW_RECEIVER_CODE__';

// ---------------------------------------------------------------------------
// Preload script generators
// ---------------------------------------------------------------------------

const defaultOptions: WebViewStreamResolvedOptions = {
  receiverReadyCallbackPath: '',
};

export const createWebViewStreamChunksPreloadScript = (options: WebViewStreamPreloadScriptOptions = {}) => {
  const resolved: WebViewStreamResolvedOptions = { ...defaultOptions, ...options };
  return `(${webViewStreamReceiverIIFECode})(${JSON.stringify(resolved)}, ${JSON.stringify(WebViewStreamEventTypes)});`;
};
