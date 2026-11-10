/**
 * Reads the cloned send-message SSE response so newly submitted user prompts
 * can appear in the navigator before the next full conversation fetch
 * completes. Also parses the outgoing POST body for the same prompt so the
 * sidebar updates before the server even starts streaming.
 *
 * Owns the SSE line buffer (`streamBuffer`) and the
 * `CHATGPT_NEW_USER_MESSAGE` message-type constant.
 */
import type { FetchArgs } from './fetchHelpers';

const NEW_USER_MESSAGE_TYPE = 'CHATGPT_NEW_USER_MESSAGE';

interface OutgoingMessage {
  id: string;
  author?: { role?: string };
  content?: unknown;
  metadata?: unknown;
  create_time?: number;
}

interface OutgoingRequestBody {
  messages?: OutgoingMessage[];
}

/**
 * Attempts to parse the outgoing POST request body to immediately capture
 * the user's prompt before the server responds.
 */
export async function extractOutgoingMessage(
  args: FetchArgs,
  routeKey: string,
  messageType: string = NEW_USER_MESSAGE_TYPE
): Promise<void> {
  try {
    const [input, init] = args;
    const body = typeof init?.body === 'string'
      ? init.body
      : init?.body == null && input instanceof Request
        ? await input.clone().text()
        : null;
    if (!body) return;

    const data = JSON.parse(body) as OutgoingRequestBody;
    if (!Array.isArray(data.messages)) return;
    const userMessage = [...data.messages].reverse().find(
      (message) => message?.author?.role === 'user' && typeof message.id === 'string'
    );
    if (!userMessage) return;

    window.postMessage(
      {
        type: messageType,
        routeKey,
        payload: {
          id: userMessage.id,
          author: { role: 'user' },
          content: userMessage.content,
          metadata: userMessage.metadata,
          createTime: userMessage.create_time ?? Date.now() / 1000,
        },
      },
      '*'
    );
  } catch {}
}

/**
 * Reads a cloned send-message SSE stream so newly submitted user prompts can
 * appear in the navigator before the next full conversation fetch completes.
 * Keeps partial lines local to this invocation, including overlapping streams.
 */
export async function inspectStream(
  response: Response,
  routeKey: string,
  messageType: string = NEW_USER_MESSAGE_TYPE
): Promise<void> {
  const reader = response.clone().body?.getReader();

  if (!reader) return;

  let streamBuffer = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      streamBuffer += decoder.decode();
      if (streamBuffer.trim()) {
        processStreamLine(streamBuffer, routeKey, messageType);
        streamBuffer = '';
      }

      break;
    }

    streamBuffer += decoder.decode(value, {
      stream: true,
    });

    const lines = streamBuffer.split('\n');
    streamBuffer = lines.pop() || '';
    for (const line of lines) {
      processStreamLine(line, routeKey, messageType);
    }
  }
}

/**
 * Parses one SSE data line and forwards ChatGPT input_message events to the
 * content script.
 */
function processStreamLine(
  line: string,
  routeKey: string,
  messageType: string
): void {
  if (!line.startsWith('data: ')) {
    return;
  }

  const jsonText = line.slice(6).trim();

  if (!jsonText || jsonText === '[DONE]') {
    return;
  }

  try {
    const data = JSON.parse(jsonText);

    if (data.type === 'input_message') {
      const message = data.input_message;
      if (!message || typeof message.id !== 'string') return;

      window.postMessage(
        {
          type: messageType,
          routeKey,
          payload: {
            id: message.id,
            author: { role: 'user' },
            content: message.content,
            metadata: message.metadata,
            createTime: message.create_time ?? Date.now() / 1000,
          },
        },
        '*'
      );
    }
  } catch {}
}
