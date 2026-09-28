'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/format';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
};

const SUGGESTED_PROMPTS = [
  'Apa itu RSI dan MACD?',
  'Ciri-ciri saham yang layak dikoleksi',
  'Beda analisa teknikal dan fundamental',
];

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.filter((m) => !m.isError).map((m) => ({ role: m.role, content: m.content })),
        }),
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
        const content = fullText;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
      }

      if (!fullText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: 'Maaf, tidak ada respons. Coba tanyakan ulang.' } : m
          )
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.';
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: message, isError: true } : m)));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Tutup asisten AI' : 'Buka asisten AI'}
        aria-expanded={isOpen}
        className="neo-press fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-2xl neo-border bg-emerald-400 text-black neo-shadow-lg lg:bottom-6 lg:right-6"
      >
        {isOpen ? <X className="size-6" strokeWidth={2.5} /> : <MessageCircle className="size-6" strokeWidth={2.5} />}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Asisten AI"
          className="fixed inset-x-4 bottom-36 z-50 flex h-[70vh] max-h-[32rem] flex-col overflow-hidden rounded-2xl neo-border bg-white neo-shadow-lg sm:inset-x-auto sm:right-4 sm:w-96 lg:bottom-24 lg:right-6 dark:bg-zinc-950"
        >
          <header className="flex shrink-0 items-center justify-between neo-border border-x-0 border-t-0 bg-emerald-400 px-4 py-3 text-black">
            <div className="flex items-center gap-2">
              <Bot className="size-5" strokeWidth={2.5} />
              <span className="text-sm font-bold uppercase tracking-wide">Asisten AI</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  aria-label="Hapus percakapan"
                  title="Hapus percakapan"
                  className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-black/10"
                >
                  <Trash2 className="size-4" strokeWidth={2.5} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup"
                className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-black/10"
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-3 dark:bg-zinc-900">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl neo-border bg-emerald-400 text-black neo-shadow-sm">
                  <Sparkles className="size-5" strokeWidth={2.5} />
                </span>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Tanyakan apa saja seputar saham, analisis, atau istilah investasi.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="neo-press rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'rounded-br-sm bg-emerald-400 text-black'
                      : message.isError
                        ? 'rounded-bl-sm border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
                        : 'rounded-bl-sm border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                  )}
                >
                  {message.content || (
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <Loader2 className="size-3.5 animate-spin" /> Mengetik...
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-end gap-2 neo-border border-x-0 border-b-0 bg-white p-2 dark:bg-zinc-950"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Tulis pertanyaan..."
              className="max-h-[120px] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Kirim pesan"
              className="neo-press flex size-9 shrink-0 items-center justify-center rounded-xl neo-border bg-emerald-400 text-black neo-shadow-sm disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" strokeWidth={2.5} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
