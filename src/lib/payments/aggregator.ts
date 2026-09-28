import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase-admin';
import { SUBSCRIPTION_CATALOG, type PaidSubscriptionTier } from '@/lib/subscriptions';
import type { PayChannel } from './types';

/**
 * Aggregator payment adapter — Alipay / WeChat collection for a personal entity.
 *
 * Rules baked into this module:
 * - Every merchant credential comes from the environment (or a protected secret
 *   ref injected as an environment variable). Nothing is hardcoded.
 * - No credential is ever logged, echoed in a response, or written to a row.
 * - Nothing here executes unless PAY_PROVIDER=aggregator and every required
 *   environment value is present; otherwise callers get a `not configured`
 *   signal and the site keeps its previous behaviour.
 *
 * Gateway contract (generic Chinese aggregator convention — MD5 or
 * HMAC-SHA256 signed form/JSON over sorted parameters):
 *   POST {gateway}/pay/create  → { code|success, message, data:{ pay_url|code_url, trade_no } }
 *   POST {notify_url}          → out_trade_no / trade_no / amount / status + sign
 *
 * The mapping helpers below are the single place to adjust once Kee's merchant
 * paperwork names the actual gateway.
 */

export interface AggregatorConfig {
  gatewayUrl: string;
  mchId: string;
  appId: string;
  secret: string;
  signType: 'md5' | 'hmac-sha256';
  notifyUrl: string;
  returnUrl: string;
}

export const NOTIFY_ACK = 'SUCCESS';

export class AggregatorNotConfiguredError extends Error {
  constructor() {
    super('Aggregator payment is not configured.');
    this.name = 'AggregatorNotConfiguredError';
  }
}

export class AggregatorGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AggregatorGatewayError';
  }
}

export class AggregatorPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AggregatorPersistenceError';
  }
}

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return '';
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Reads merchant configuration. Returns null when the channel is not usable. */
export function getAggregatorConfig(): AggregatorConfig | null {
  const gatewayUrl = readEnv('PAY_AGGREGATOR_GATEWAY_URL').replace(/\/+$/, '');
  const mchId = readEnv('PAY_AGGREGATOR_MCH_ID');
  const secret = readEnv('PAY_AGGREGATOR_SECRET');
  const appUrl = readEnv('APP_URL').replace(/\/+$/, '');

  if (!gatewayUrl || !mchId || !secret || !appUrl) return null;
  if (!isHttpUrl(gatewayUrl) || !isHttpUrl(appUrl)) return null;

  const signType = readEnv('PAY_AGGREGATOR_SIGN_TYPE').toLowerCase() === 'md5' ? 'md5' : 'hmac-sha256';
  const notifyUrl = readEnv('PAY_AGGREGATOR_NOTIFY_URL') || `${appUrl}/api/pay/notify`;
  const returnUrl = readEnv('PAY_AGGREGATOR_RETURN_URL') || `${appUrl}/payment/success`;

  return {
    gatewayUrl,
    mchId,
    appId: readEnv('PAY_AGGREGATOR_APP_ID'),
    secret,
    signType,
    notifyUrl,
    returnUrl,
  };
}

/** True when the aggregator can actually take orders. */
export function isAggregatorReady(): boolean {
  return getAggregatorConfig() !== null;
}

type ParamValue = string | number | boolean | null | undefined;
export type SignableParams = Record<string, ParamValue>;

function canonicalQuery(params: SignableParams): string {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'sign_type' && params[key] !== undefined && params[key] !== null)
    .filter((key) => String(params[key]).trim() !== '')
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');
}

export function signParams(
  params: SignableParams,
  secret: string,
  signType: AggregatorConfig['signType'],
): string {
  const base = canonicalQuery(params);
  if (signType === 'md5') {
    return createHash('md5').update(`${base}&key=${secret}`, 'utf8').digest('hex').toUpperCase();
  }
  return createHmac('sha256', secret).update(base, 'utf8').digest('hex');
}

/** Constant-time signature check. Never logs the payload or the secret. */
export function verifySignature(
  params: SignableParams,
  secret: string,
  signType: AggregatorConfig['signType'],
): boolean {
  const provided = typeof params.sign === 'string' ? params.sign.trim() : '';
  if (!provided) return false;

  const expected = Buffer.from(signParams(params, secret, signType).toLowerCase(), 'utf8');
  const actual = Buffer.from(provided.toLowerCase(), 'utf8');
  if (expected.length !== actual.length) return false;

  try {
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function generateOutTradeNo(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `DYN${stamp}${suffix}`;
}

export function amountCentsForTier(tier: PaidSubscriptionTier): number {
  return SUBSCRIPTION_CATALOG[tier].amount * 100;
}

function stripSecrets(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripSecrets);

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (/sign|secret|key|token/i.test(key)) continue;
    out[key] = stripSecrets(entry);
  }
  return out;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function pick(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return null;
}

export interface GatewayOrderResult {
  payUrl: string | null;
  qrCode: string | null;
  providerTradeNo: string | null;
  raw: Record<string, unknown>;
}

/** Places the order with the gateway. Throws AggregatorGatewayError on failure. */
export async function createGatewayOrder(input: {
  outTradeNo: string;
  tier: PaidSubscriptionTier;
  channel: PayChannel;
  amountCents: number;
  subject: string;
}): Promise<GatewayOrderResult> {
  const config = getAggregatorConfig();
  if (!config) throw new AggregatorNotConfiguredError();

  const params: SignableParams = {
    mch_id: config.mchId,
    app_id: config.appId,
    out_trade_no: input.outTradeNo,
    amount: input.amountCents,
    currency: 'CNY',
    channel: input.channel,
    subject: input.subject,
    notify_url: config.notifyUrl,
    return_url: `${config.returnUrl}?order=${input.outTradeNo}`,
    timestamp: Math.floor(Date.now() / 1000),
    nonce_str: randomBytes(8).toString('hex'),
  };

  const body = {
    ...params,
    sign_type: config.signType,
    sign: signParams(params, config.secret, config.signType),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(`${config.gatewayUrl}/pay/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    throw new AggregatorGatewayError('Payment gateway is unreachable.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AggregatorGatewayError(`Payment gateway returned HTTP ${response.status}.`);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    payload = parsed as Record<string, unknown>;
  } catch {
    throw new AggregatorGatewayError('Payment gateway returned an unreadable response.');
  }

  const data = (
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : payload
  ) as Record<string, unknown>;

  const code = String(pick(payload, ['code', 'ret_code', 'status', 'result_code']) ?? '').toLowerCase();
  const accepted = ['success', 'ok', '0', '00', '200'].includes(code) || payload.success === true;

  if (!accepted) {
    throw new AggregatorGatewayError(
      pick(payload, ['message', 'msg', 'err_msg']) ?? 'Payment gateway rejected the order.',
    );
  }

  return {
    payUrl: pick(data, ['pay_url', 'payUrl', 'mweb_url', 'h5_url']) ?? pick(data, ['code_url']),
    qrCode: pick(data, ['qr_code', 'qrCode', 'code_url']),
    providerTradeNo: pick(data, ['trade_no', 'transaction_id', 'prepay_id']),
    raw: stripSecrets(payload) as Record<string, unknown>,
  };
}

export type NotifyPayload = Record<string, string>;

/** Accepts both JSON and form-encoded callbacks. */
export function parseNotifyPayload(rawBody: string, contentType: string | null): NotifyPayload {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};

  const isJson = (contentType ?? '').includes('json') || trimmed.startsWith('{');
  if (isJson) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

      const out: NotifyPayload = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const flat = asString(value);
        if (flat !== null) out[key] = flat;
      }
      const nested = (parsed as Record<string, unknown>).data;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
          const flat = asString(value);
          if (flat !== null && !(key in out)) out[key] = flat;
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  const out: NotifyPayload = {};
  new URLSearchParams(trimmed).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export interface NotifyOutcome {
  outTradeNo: string;
  providerTradeNo: string | null;
  amountCents: number | null;
  success: boolean;
}

/**
 * Cents by contract: we send `amount` in cents, so a bare integer response is
 * read as cents. A decimal string ("29.00") is read as yuan and converted.
 */
export function parseAmountCents(value: unknown): number | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const numeric = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

export function interpretNotify(params: NotifyPayload): NotifyOutcome | null {
  const outTradeNo = pick(params, ['out_trade_no', 'outTradeNo', 'order_no', 'merchant_order_no']);
  if (!outTradeNo) return null;

  const statusRaw = (
    pick(params, ['trade_status', 'status', 'result_code', 'pay_status']) ?? ''
  ).toLowerCase();
  const success =
    params.success === 'true' ||
    ['success', 'trade_success', 'paid', 'true', 'ok', '00', '1', '2'].includes(statusRaw);

  return {
    outTradeNo,
    providerTradeNo: pick(params, ['trade_no', 'transaction_id', 'channel_trade_no']),
    amountCents: parseAmountCents(pick(params, ['amount', 'total_fee', 'total_amount', 'pay_amount', 'money'])),
    success,
  };
}

export type GrantResult = 'granted' | 'duplicate' | 'not_found' | 'amount_mismatch' | 'closed' | 'no_user';

/** Idempotent grant: the database function locks the order before granting. */
export async function grantAggregatorSubscription(input: {
  outTradeNo: string;
  providerTradeNo: string | null;
  amountCents: number | null;
  rawNotify: unknown;
}): Promise<GrantResult> {
  const client = getServiceClient();
  const { data, error } = await client.rpc('grant_aggregator_subscription', {
    p_out_trade_no: input.outTradeNo,
    p_provider_trade_no: input.providerTradeNo,
    p_amount_cents: input.amountCents,
    p_raw_notify: stripSecrets(input.rawNotify),
  });

  if (error) throw new AggregatorPersistenceError(`Unable to grant subscription: ${error.message}`);

  const result = typeof data === 'string' ? data : '';
  const allowed: GrantResult[] = ['granted', 'duplicate', 'not_found', 'amount_mismatch', 'closed', 'no_user'];
  if (!allowed.includes(result as GrantResult)) {
    throw new AggregatorPersistenceError('Subscription grant returned an unexpected state.');
  }
  return result as GrantResult;
}

export interface PaymentOrderStatus {
  outTradeNo: string;
  tier: string;
  channel: string;
  status: string;
  amountCents: number;
  paidAt: string | null;
  createdAt: string;
}

/** Owner-scoped order lookup for /api/pay/status. */
export async function readOrderStatus(input: {
  userId: string;
  outTradeNo: string;
}): Promise<PaymentOrderStatus | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('payment_orders')
    .select('out_trade_no, tier, channel, status, amount_cents, paid_at, created_at')
    .eq('out_trade_no', input.outTradeNo)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) throw new AggregatorPersistenceError(`Unable to read order: ${error.message}`);
  if (!data) return null;

  return {
    outTradeNo: String(data.out_trade_no),
    tier: String(data.tier),
    channel: String(data.channel),
    status: String(data.status),
    amountCents: Number(data.amount_cents),
    paidAt: (data.paid_at as string | null) ?? null,
    createdAt: String(data.created_at),
  };
}

/** Marks a failed callback / failed gateway call. Never records raw secrets. */
export async function markOrderStatus(input: {
  outTradeNo: string;
  status: 'failed' | 'expired' | 'review';
  note?: string;
  rawNotify?: unknown;
}): Promise<void> {
  const client = getServiceClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.note) patch.review_note = input.note.slice(0, 500);
  if (input.rawNotify !== undefined) patch.raw_notify = stripSecrets(input.rawNotify);

  const { error } = await client.from('payment_orders').update(patch).eq('out_trade_no', input.outTradeNo);
  if (error) throw new AggregatorPersistenceError(`Unable to update order: ${error.message}`);
}
