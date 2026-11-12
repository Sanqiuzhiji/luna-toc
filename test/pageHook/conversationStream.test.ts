/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractOutgoingMessage,
  inspectStream,
} from '@/pageHook/conversationStream';

describe('conversationStream payload author role', () => {
  let postedMessages: any[] = [];
  let messageHandler: (event: MessageEvent) => void;

  beforeEach(() => {
    postedMessages = [];
    messageHandler = (event: MessageEvent) => {
      postedMessages.push(event.data);
    };
    window.addEventListener('message', messageHandler);
  });

  afterEach(() => {
    window.removeEventListener('message', messageHandler);
  });

  it('includes author: { role: "user" } and createTime in extractOutgoingMessage payload', async () => {
    const outgoingBody = {
      parent_message_id: 'assistant-parent',
      messages: [
        {
          id: 'user-msg-outgoing',
          author: { role: 'user' },
          content: { parts: ['Hello from outgoing prompt'] },
          metadata: { attachments: [] },
          create_time: 1712345678,
        },
      ],
    };

    extractOutgoingMessage(
      [
        'https://chatgpt.com/backend-api/conversation',
        {
          method: 'POST',
          body: JSON.stringify(outgoingBody),
        },
      ],
      'route-test',
      'CHATGPT_NEW_USER_MESSAGE'
    );

    await vi.waitFor(() => {
      expect(postedMessages).toHaveLength(1);
    });
    const event = postedMessages[0];
    expect(event.type).toBe('CHATGPT_NEW_USER_MESSAGE');
    expect(event.payload.id).toBe('user-msg-outgoing');
    expect(event.payload.author).toEqual({ role: 'user' });
    expect(event.payload.createTime).toBe(1712345678);
    expect(event.payload.parentMessageId).toBe('assistant-parent');
  });

  it('reads the effective Request body and selects the newest user message', async () => {
    const request = new Request('https://chatgpt.com/backend-api/f/conversation', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { id: 'old', author: { role: 'user' }, content: { parts: ['Old'] } },
          { id: 'reply', author: { role: 'assistant' }, content: { parts: ['Reply'] } },
          { id: 'new', author: { role: 'user' }, content: { parts: ['New'] } },
        ],
      }),
    });

    await extractOutgoingMessage([request], 'route-test');
    await vi.waitFor(() => expect(postedMessages).toHaveLength(1));
    expect(postedMessages[0].payload.id).toBe('new');
    expect(request.bodyUsed).toBe(false);
  });

  it('uses init.body when it overrides a Request and ignores malformed JSON', async () => {
    const request = new Request('https://chatgpt.com/backend-api/f/conversation', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ id: 'old', author: { role: 'user' } }] }),
    });
    await extractOutgoingMessage([request, {
      body: JSON.stringify({ messages: [
        { id: 'new', author: { role: 'user' }, content: { parts: ['New'] } },
      ] }),
    }], 'route-test');
    await extractOutgoingMessage(['https://chatgpt.com/backend-api/f/conversation', {
      body: '{invalid',
    }], 'route-test');

    await vi.waitFor(() => expect(postedMessages).toHaveLength(1));
    expect(postedMessages[0].payload.id).toBe('new');
  });

  it('includes author: { role: "user" } and createTime in SSE input_message payload', async () => {
    const sseChunk =
      'data: {"type":"input_message","input_message":{"id":"user-msg-stream","content":{"parts":["Hello from stream"]},"metadata":{},"create_time":1712345690}}\n\n';

    const response = new Response(sseChunk, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

    await inspectStream(response, 'route-test', 'CHATGPT_NEW_USER_MESSAGE');

    await vi.waitFor(() => {
      expect(postedMessages).toHaveLength(1);
    });
    const event = postedMessages[0];
    expect(event.type).toBe('CHATGPT_NEW_USER_MESSAGE');
    expect(event.payload.id).toBe('user-msg-stream');
    expect(event.payload.author).toEqual({ role: 'user' });
    expect(event.payload.createTime).toBe(1712345690);
  });
});
