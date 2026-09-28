/**
 * Shared payment types. Safe to import from both server and client code —
 * this module must never read the environment or touch secrets.
 */

export type PayProvider = 'off' | 'aggregator';

export const PAY_CHANNELS = ['alipay', 'wechat'] as const;
export type PayChannel = (typeof PAY_CHANNELS)[number];

export const PAY_CHANNEL_LABELS: Readonly<Record<PayChannel, string>> = {
  alipay: '💙 支付宝',
  wechat: '💚 微信支付',
};

export function isPayChannel(value: unknown): value is PayChannel {
  return typeof value === 'string' && (PAY_CHANNELS as readonly string[]).includes(value);
}
