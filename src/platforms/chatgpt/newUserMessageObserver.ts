/** Observes newly mounted ChatGPT user messages as a fallback to network capture. */
import type { ChatMessage } from '@/features/conversationPrompts/message';

const USER_MESSAGE_SELECTOR = [
  '[data-chatgpt-search-unit-key$=":user"]',
  '[data-message-author-role="user"]',
].join(', ');

/**
 * Reports a newly mounted user message once its ID and content are available.
 * Returns a cleanup function for the owning controller's attachment lifecycle.
 *
 * @example
 * const disconnect = observeNewUserMessages((message) => handleMessage(message));
 */
export function observeNewUserMessages(
  onMessage: (message: ChatMessage) => void
): () => void {
  const observedDocument = document;
  const reportedIds = new WeakMap<HTMLElement, string>();

  function inspectUserMessage(element: HTMLElement): void {
    if (!element.isConnected) return;
    const id = element.getAttribute('data-chatgpt-search-message-ids')
      || element.getAttribute('data-message-id');
    if (!id || reportedIds.get(element) === id) return;

    const bubble = element.querySelector<HTMLElement>('[data-user-message-bubble="true"]')
      || element;
    const text = bubble.textContent?.trim() || '';
    if (!text) return;

    reportedIds.set(element, id);
    onMessage({
      id,
      author: { role: 'user' },
      content: { parts: [text] },
      createTime: Date.now() / 1000,
    });
  }

  function inspectNode(node: Node, scanDescendants: boolean): void {
    const element = node.nodeType === 1
      ? node as HTMLElement
      : node.parentElement;
    if (!element) return;
    if (element.closest('#luna-toc-sidebar, #luna-toc-react-host, #navigator-list, #myprompts-list')) return;
    const owner = element.closest<HTMLElement>(USER_MESSAGE_SELECTOR);
    if (owner) inspectUserMessage(owner);
    if (node.nodeType !== 1 || !scanDescendants) return;
    if (element.matches(USER_MESSAGE_SELECTOR)) inspectUserMessage(element);
    element.querySelectorAll<HTMLElement>(USER_MESSAGE_SELECTOR).forEach(inspectUserMessage);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      inspectNode(mutation.target, false);
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => inspectNode(node, true));
      }
    }
  });
  const bootstrap = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => {
      const target = mutation.target as Element;
      return target.nodeType === 1 && Boolean(target.closest(
        '#luna-toc-sidebar, #luna-toc-react-host, #navigator-list, #myprompts-list'
      ));
    })) return;
    if (!attachToThread()) watchForThread();
  });

  function attachToThread(): boolean {
    const threads = observedDocument.querySelectorAll<HTMLElement>('.thread-scroll-container');
    const thread = Array.from(threads).filter((element) => element.isConnected).at(-1);
    if (!thread) return false;
    bootstrap.disconnect();
    observer.observe(thread, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'data-chatgpt-search-unit-key',
        'data-chatgpt-search-message-ids',
        'data-message-author-role',
        'data-message-id',
      ],
    });
    return true;
  }

  function watchForThread(): void {
    const appRoot = observedDocument.querySelector('#__next, #root, main');
    bootstrap.disconnect();
    bootstrap.observe(appRoot || observedDocument.body, {
      subtree: Boolean(appRoot),
      childList: true,
    });
  }

  if (!attachToThread()) watchForThread();
  return () => {
    observer.disconnect();
    bootstrap.disconnect();
  };
}
