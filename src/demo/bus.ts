// In-browser eventbus: vervangt de socket.io-verbinding met de backend.
// De demo-engine publiceert hier guardrail-events; de pagina luistert mee.
import type { GuardrailEvent } from '@/lib/types';

type Handler = (event: GuardrailEvent) => void;
const handlers = new Map<string, Set<Handler>>();

export const bus = {
  on(channel: string, handler: Handler) {
    if (!handlers.has(channel)) handlers.set(channel, new Set());
    handlers.get(channel)!.add(handler);
  },
  off(channel: string, handler?: Handler) {
    if (!handler) handlers.delete(channel);
    else handlers.get(channel)?.delete(handler);
  },
  emit(channel: string, event: GuardrailEvent) {
    handlers.get(channel)?.forEach(h => h(event));
  },
};
