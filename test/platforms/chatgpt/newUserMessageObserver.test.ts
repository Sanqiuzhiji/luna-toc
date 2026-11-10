/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeNewUserMessages } from '@/platforms/chatgpt/newUserMessageObserver';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('new user message DOM fallback', () => {
  it('waits for the ID and text, reports once, and ignores assistant changes', async () => {
    const thread = document.createElement('div');
    thread.className = 'thread-scroll-container';
    document.body.append(thread);
    const onMessage = vi.fn();
    const disconnect = observeNewUserMessages(onMessage);
    const prompt = document.createElement('div');
    prompt.setAttribute('data-chatgpt-search-unit-key', 'turn:user');
    thread.append(prompt);
    await vi.waitFor(() => expect(onMessage).not.toHaveBeenCalled());

    prompt.setAttribute('data-chatgpt-search-message-ids', 'new-id');
    prompt.append(document.createTextNode('New prompt'));
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
    expect(onMessage.mock.calls[0][0]).toMatchObject({
      id: 'new-id', content: { parts: ['New prompt'] },
    });

    prompt.append(document.createElement('span'));
    const assistant = document.createElement('div');
    assistant.setAttribute('data-chatgpt-search-unit-key', 'turn:assistant');
    assistant.setAttribute('data-chatgpt-search-message-ids', 'assistant-id');
    assistant.textContent = 'Answer';
    thread.append(assistant);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onMessage).toHaveBeenCalledTimes(1);

    disconnect();
    const next = document.createElement('div');
    next.setAttribute('data-message-author-role', 'user');
    next.setAttribute('data-message-id', 'after-disconnect');
    next.textContent = 'Another prompt';
    thread.append(next);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('recognizes multiple rapid legacy user nodes without duplication', async () => {
    const onMessage = vi.fn();
    const disconnect = observeNewUserMessages(onMessage);
    const thread = document.createElement('div');
    thread.className = 'thread-scroll-container';
    document.body.append(thread);
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const id of ['one', 'two', 'three']) {
      const prompt = document.createElement('div');
      prompt.setAttribute('data-message-author-role', 'user');
      prompt.setAttribute('data-message-id', id);
      prompt.textContent = id;
      thread.append(prompt);
    }
    await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(3));
    expect(onMessage.mock.calls.map(([message]) => message.id)).toEqual(['one', 'two', 'three']);
    disconnect();
  });
});
