/** Verifies ChatGPT send-request classification for supported endpoints. */
import { describe, expect, it } from 'vitest';
import { isSendMessagePath } from '@/platforms/chatgpt/contentCapture';

describe('ChatGPT send request classification', () => {
  it('accepts supported POST paths and rejects unrelated requests', () => {
    expect(isSendMessagePath('POST', '/backend-api/f/conversation')).toBe(true);
    expect(isSendMessagePath('POST', '/backend-api/conversation')).toBe(true);
    expect(isSendMessagePath('GET', '/backend-api/f/conversation')).toBe(false);
    expect(isSendMessagePath('POST', '/backend-api/conversations/id')).toBe(false);
  });
});
