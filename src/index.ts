// High-level API (preferred)
export { WebViewStreamSender } from './sender';
export type { WebViewStreamTransport } from './sender';

// Preload script generators
export { createWebViewStreamChunksPreloadScript } from './streamChunksPreloadScript';
export type { PayloadScriptInjectionOptions, WebViewStreamPreloadScriptOptions } from './streamChunksPreloadScript';

// Low-level event protocol (advanced usage)
export { WebViewStreamEventTypes } from './streamChunksPreloadScript';
export type { WebViewStreamEventType, WebViewStreamReceiverEvent } from './streamChunksPreloadScript';
