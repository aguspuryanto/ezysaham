import { CHAT_SYSTEM_PROMPT, RESEARCH_REPORT_SYSTEM_PROMPT } from '@/lib/aiPrompts';

// Server-only proxy to the BangunWeb AI router (OpenAI-compatible, https://bangunweb.com/ai/docs).
// BANGUNWEB_APIKEY must never reach the browser, so the widget calls this route instead.
const MODEL = process.env.BANGUNWEB_MODEL || 'deepseek-v4-flash';
const MAX_HISTORY = 20;

// "research" sends one large prompt built from the computed stock analysis, so it gets a higher cap.
const PROMPTS = {
  chat: { system: CHAT_SYSTEM_PROMPT, maxContentLength: 4000 },
  research: { system: RESEARCH_REPORT_SYSTEM_PROMPT, maxContentLength: 20000 },
} as const;

type Kind = keyof typeof PROMPTS;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function sanitize(input: unknown, maxContentLength: number): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const messages = input.slice(-MAX_HISTORY).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m?.content === 'string' ? m.content.slice(0, maxContentLength) : '',
  })) as ChatMessage[];
  return messages.some((m) => m.content.trim()) ? messages : null;
}

export async function POST(request: Request) {
  const apiKey = process.env.BANGUNWEB_APIKEY;
  const baseUrl = process.env.BANGUNWEB_BASEURL || 'https://router.bangunweb.com/v1';
  if (!apiKey) {
    return Response.json({ ok: false, message: 'AI belum dikonfigurasi.' }, { status: 500 });
  }

  let messages: ChatMessage[] | null = null;
  let kind: Kind = 'chat';
  try {
    const body = (await request.json()) as { kind?: unknown; messages?: unknown };
    if (body.kind === 'research') kind = 'research';
    messages = sanitize(body.messages, PROMPTS[kind].maxContentLength);
  } catch {}
  if (!messages) {
    return Response.json({ ok: false, message: 'Pesan tidak valid.' }, { status: 400 });
  }

  const upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: 'system', content: PROMPTS[kind].system }, ...messages],
    }),
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('[ai-chat] upstream error', upstream.status, detail);
    return Response.json({ ok: false, message: 'Layanan AI sedang tidak tersedia. Coba lagi.' }, { status: 502 });
  }

  // Convert the OpenAI-style SSE stream into a plain text stream of content deltas.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const text = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith('data:')) continue;
          const payload = data.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {}
        }
      },
    })
  );

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
