'use client';

/**
 * useAiReport.ts
 *
 * Streams one AI report from /api/ai-chat (see src/app/api/ai-chat/route.ts)
 * and exposes it as sanitized HTML. The prompt is built lazily on generate()
 * so callers can fetch extra data (e.g. smart-flow, which costs API quota)
 * only when the user explicitly asks for a report.
 */

import { useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AiReportKind } from '@/domain/ai/promptBuilders';

export type AiReportState = 'idle' | 'loading' | 'done' | 'error';

export function useAiReport() {
  const [state, setState] = useState<AiReportState>('idle');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const html = useMemo(() => {
    if (!markdown) return '';
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  function reset() {
    abortRef.current?.abort();
    setState('idle');
    setMarkdown('');
    setError('');
  }

  async function generate(kind: AiReportKind, buildPrompt: () => string | Promise<string>) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState('loading');
    setMarkdown('');
    setError('');

    try {
      const content = await buildPrompt();
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, messages: [{ role: 'user', content }] }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || 'Terjadi kesalahan pada AI.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMarkdown(fullText);
      }

      if (!fullText) throw new Error('Tidak ada respons dari AI. Coba lagi.');
      setState('done');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.');
      setState('error');
    }
  }

  return { state, markdown, html, error, generate, reset };
}
