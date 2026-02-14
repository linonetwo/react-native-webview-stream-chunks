import { type PayloadScriptInjectionOptions, type WebViewStreamEventType, WebViewStreamEventTypes } from './streamChunksPreloadScript';

/**
 * Transport function that delivers a message to the WebView.
 * The user is responsible for implementing the actual delivery mechanism
 * (e.g. `webViewRef.current.injectJavaScript()`).
 */
export type WebViewStreamTransport = (eventType: WebViewStreamEventType, data?: string) => void;

/**
 * High-level API for streaming content into a WebView.
 *
 * Wraps the low-level event protocol so callers never need to deal with
 * event type constants, message serialisation, or sequencing concerns.
 *
 * @example
 * ```ts
 * const sender = new WebViewStreamSender((type, data) => {
 *   webViewRef.current.injectJavaScript(
 *     `window.onStreamChunksToWebView(${JSON.stringify({ type, data })});`
 *   );
 * });
 *
 * sender.checkReceiverReady();
 * sender.setContent(html);
 * sender.appendChunk(chunk);
 * sender.finalizePayload();
 * sender.reexecuteScripts();
 * ```
 */
export class WebViewStreamSender {
  private readonly transport: WebViewStreamTransport;

  constructor(transport: WebViewStreamTransport) {
    this.transport = transport;
  }

  /**
   * Ask the receiver whether it is ready. The receiver will invoke its
   * configured `receiverReadyCallbackPath` when it handles this event.
   */
  checkReceiverReady(): void {
    this.transport(WebViewStreamEventTypes.CHECK_RECEIVER_READY);
  }

  /**
   * Replace the WebView's `document.body.innerHTML` with the provided HTML.
   * This also resets any previously buffered chunks.
   */
  setContent(html: string): void {
    this.transport(WebViewStreamEventTypes.SET_CONTENT, html);
  }

  /**
   * Buffer a chunk in the receiver. Call this as many times as needed.
   */
  appendChunk(chunk: string): void {
    this.transport(WebViewStreamEventTypes.APPEND_CHUNK, chunk);
  }

  /**
   * Join all buffered chunks and inject them as a single `<script>` tag
   * into the DOM.
   *
   * This does NOT re-execute existing scripts — call `reexecuteScripts()`
   * separately when needed.
   */
  finalizePayload(options?: PayloadScriptInjectionOptions): void {
    this.transport(WebViewStreamEventTypes.FINALIZE_PAYLOAD, options ? JSON.stringify(options) : undefined);
  }

  /**
   * Re-execute `<script>` tags in the DOM by replacing them with clones.
   *
   * @param selector - optional CSS selector to limit which scripts are
   *   re-executed. Defaults to `'script'` (all scripts).
   *   The payload `<script>` injected by `finalizePayload()` is always
   *   excluded automatically.
   */
  reexecuteScripts(selector?: string): void {
    this.transport(WebViewStreamEventTypes.REEXECUTE_SCRIPTS, selector);
  }
}
