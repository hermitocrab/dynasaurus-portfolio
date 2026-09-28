export interface ChatStreamEvent {
  c?: string;
  done?: boolean;
  error?: string;
}

/**
 * Consume the single-line JSON SSE events emitted by /api/chat.
 * Network chunks do not align with SSE line boundaries, so the unfinished
 * tail must be retained between reads.
 */
export async function consumeChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void | boolean,
) {
  if (!response.body) throw new Error('The response stream is unavailable.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeLine = (line: string) => {
    if (!line.startsWith('data:')) return true;
    const json = line.slice(5).trim();
    if (!json) return true;

    let event: ChatStreamEvent;
    try {
      event = JSON.parse(json) as ChatStreamEvent;
    } catch {
      throw new Error('The response stream contained an invalid event.');
    }

    return onEvent(event) !== false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!consumeLine(line)) return;
      }
    }

    buffer += decoder.decode();
    if (buffer && !consumeLine(buffer)) return;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
