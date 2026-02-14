// ---------------------------------------------------------------------------
// Receiver IIFE — serialised via `.toString()` and injected into the WebView.
// ---------------------------------------------------------------------------

import type { PayloadScriptInjectionOptions, WebViewStreamReceiverEvent } from './streamChunksPreloadScript';

interface WebViewStreamResolvedOptions {
  receiverReadyCallbackPath: string;
}

interface ResolvedPayloadScriptInjectionOptions {
  scriptType: string;
  scriptClassName: string;
  scriptTagName: string;
  anchorSelector: string;
}

// Keep in sync with streamChunksPreloadScript.ts
const _EventTypes = {
  CHECK_RECEIVER_READY: 'CHECK_RECEIVER_READY',
  SET_CONTENT: 'SET_CONTENT',
  APPEND_CHUNK: 'APPEND_CHUNK',
  FINALIZE_PAYLOAD: 'FINALIZE_PAYLOAD',
  REEXECUTE_SCRIPTS: 'REEXECUTE_SCRIPTS',
} as const;

export function webViewStreamReceiverIIFE(options: WebViewStreamResolvedOptions, eventTypes: typeof _EventTypes) {
  let payloadChunks: string[] = [];
  let contentMutationObserved = false;
  const injectedPayloadScriptClasses = new Set<string>();

  function resetState() {
    payloadChunks = [];
    contentMutationObserved = false;
  }

  const targetWindow = window as Window & {
    onStreamChunksToWebView?: (event: WebViewStreamReceiverEvent) => void;
  };

  // -- receiver-ready callback resolver -------------------------------------

  function runReceiverReadyCallback() {
    if (!options.receiverReadyCallbackPath.trim()) return;

    const segments = options.receiverReadyCallbackPath.split('.').filter(Boolean);
    let current: unknown = targetWindow as unknown;
    for (const segment of segments) {
      if (current === null || current === undefined || typeof current !== 'object') {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === 'function') {
      (current as () => void)();
    }
  }

  // -- event dispatcher -----------------------------------------------------

  targetWindow.onStreamChunksToWebView = function(event) {
    switch (event.type) {
      case eventTypes.SET_CONTENT: {
        resetState();
        replaceBodyContent(event.data ?? '');
        break;
      }
      case eventTypes.APPEND_CHUNK: {
        if (event.data) payloadChunks.push(event.data);
        break;
      }
      case eventTypes.FINALIZE_PAYLOAD: {
        const waitAndInject = () => {
          if (contentMutationObserved) {
            injectPayloadScript(event.data);
          } else {
            setTimeout(waitAndInject, 100);
          }
        };
        waitAndInject();
        break;
      }
      case eventTypes.REEXECUTE_SCRIPTS: {
        const waitAndExec = () => {
          if (contentMutationObserved) {
            reexecuteScripts(event.data);
          } else {
            setTimeout(waitAndExec, 100);
          }
        };
        waitAndExec();
        break;
      }
      case eventTypes.CHECK_RECEIVER_READY: {
        runReceiverReadyCallback();
        break;
      }
    }
  };

  // -- DOM helpers ----------------------------------------------------------

  function replaceBodyContent(newInnerHTML: string) {
    const observer = new MutationObserver((mutationsList, currentObserver) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          currentObserver.disconnect();
          contentMutationObserved = true;
          return;
        }
      }
    });

    observer.observe(document.body, { childList: true });

    document.body.innerHTML = newInnerHTML;
  }

  const defaultInjectionOptions: ResolvedPayloadScriptInjectionOptions = {
    scriptType: 'application/json',
    scriptClassName: 'webview-stream-payload',
    scriptTagName: 'default-payload',
    anchorSelector: '#styleArea',
  };

  function resolveInjectionOptions(rawData?: string): ResolvedPayloadScriptInjectionOptions {
    if (!rawData) {
      return defaultInjectionOptions;
    }
    try {
      const parsed = JSON.parse(rawData) as PayloadScriptInjectionOptions;
      return {
        scriptType: parsed.scriptType ?? defaultInjectionOptions.scriptType,
        scriptClassName: parsed.scriptClassName ?? defaultInjectionOptions.scriptClassName,
        scriptTagName: parsed.scriptTagName ?? defaultInjectionOptions.scriptTagName,
        anchorSelector: parsed.anchorSelector ?? defaultInjectionOptions.anchorSelector,
      };
    } catch {
      return defaultInjectionOptions;
    }
  }

  function injectPayloadScript(rawData?: string) {
    try {
      const injectionOptions = resolveInjectionOptions(rawData);
      const fullPayload = payloadChunks.join('');
      const scriptElement = document.createElement('script');
      scriptElement.type = injectionOptions.scriptType;
      scriptElement.classList.add(injectionOptions.scriptClassName, injectionOptions.scriptTagName);
      scriptElement.textContent = fullPayload;
      const anchor = document.querySelector(injectionOptions.anchorSelector);
      anchor?.insertAdjacentElement('afterend', scriptElement);
      injectedPayloadScriptClasses.add(injectionOptions.scriptClassName);
    } catch (error) {
      console.error('[webview-stream] injectPayloadScript error', error);
    }
    payloadChunks = [];
  }

  function reexecuteScripts(selector?: string) {
    try {
      const query = selector?.trim() || 'script';
      const elements = Array.from(document.querySelectorAll(query));
      for (const element of elements) {
        if (!(element instanceof HTMLScriptElement)) continue;
        let isInjectedPayloadScript = false;
        for (const payloadClassName of injectedPayloadScriptClasses) {
          if (element.classList.contains(payloadClassName)) {
            isInjectedPayloadScript = true;
            break;
          }
        }
        if (isInjectedPayloadScript) continue;

        const replacement = document.createElement('script');
        for (const { name, value } of Array.from(element.attributes)) {
          replacement.setAttribute(name, value);
        }
        if (element.src) {
          replacement.src = element.src;
        } else {
          replacement.textContent = element.textContent;
        }
        if (element.parentNode !== null) {
          try {
            element.parentNode.replaceChild(replacement, element);
          } catch (error) {
            console.error('[webview-stream] Failed to re-execute script tag', replacement, element, error);
          }
        }
      }
    } catch (error) {
      console.error('[webview-stream] reexecuteScripts error', error);
    }
  }
}
