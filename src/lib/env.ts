type RequiredServerEnvName =
  | 'APP_URL'
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'STRIPE_PRICE_BASIC'
  | 'STRIPE_PRICE_PREMIUM'
  | 'STRIPE_PRICE_ULTIMATE'
  | 'OPENROUTER_API_KEY'
  | 'DEEPSEEK_API_KEY'
  | 'WHISPER_API_URL'
  | 'WHISPER_SERVICE_TOKEN';

export type ServerEnv = Readonly<Record<RequiredServerEnvName, string>>;

const REQUIRED_SERVER_ENV_NAMES: readonly RequiredServerEnvName[] = [
  'APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_BASIC',
  'STRIPE_PRICE_PREMIUM',
  'STRIPE_PRICE_ULTIMATE',
  'OPENROUTER_API_KEY',
  'DEEPSEEK_API_KEY',
  'WHISPER_API_URL',
  'WHISPER_SERVICE_TOKEN',
];

let cachedServerEnv: ServerEnv | undefined;

function validateHttpUrl(
  name: 'APP_URL' | 'NEXT_PUBLIC_SUPABASE_URL' | 'WHISPER_API_URL',
  value: string,
) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use http or https.`);
  }
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const missing = REQUIRED_SERVER_ENV_NAMES.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const values = Object.fromEntries(
    REQUIRED_SERVER_ENV_NAMES.map((name) => [name, process.env[name]!.trim()]),
  ) as Record<RequiredServerEnvName, string>;

  validateHttpUrl('APP_URL', values.APP_URL);
  validateHttpUrl('NEXT_PUBLIC_SUPABASE_URL', values.NEXT_PUBLIC_SUPABASE_URL);
  validateHttpUrl('WHISPER_API_URL', values.WHISPER_API_URL);

  cachedServerEnv = Object.freeze(values);
  return cachedServerEnv;
}
