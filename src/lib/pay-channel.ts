'use client';

import { useSyncExternalStore } from 'react';
import type { PayChannel } from './payments/types';

/**
 * Selected aggregator payment channel (Alipay / WeChat), shared by the pricing
 * strip and every checkout button on the page.
 */

let current: PayChannel = 'alipay';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PayChannel {
  return current;
}

function getServerSnapshot(): PayChannel {
  return 'alipay';
}

export function setPayChannel(next: PayChannel) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function usePayChannel(): PayChannel {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
