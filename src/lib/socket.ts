'use client';
// Demo-versie: geen WebSocket-server. Events komen van de in-browser demo-engine.
import { bus } from '@/demo/bus';

export function getSocket() {
  return bus;
}

export function joinSession(_sessionId: string): void {
  // Eén sessie per browsertabblad; niets te doen.
}
