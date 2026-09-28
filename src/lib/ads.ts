/**
 * Free-tier ad configuration.
 *
 * Everything is driven by public environment variables and is OFF by default:
 * an unconfigured deployment renders no ad markup and loads no ad script.
 *
 * Hard rule enforced by `shouldShowAds`: only the free tier ever sees an ad.
 * Paid tiers (basic / premium / ultimate) return false, and so does the
 * unknown state used when an entitlement lookup fails.
 */

export type AdsNetwork = 'adsense' | 'baidu' | 'custom';
export type AdPlacement = 'result' | 'sidebar';

export const AD_NETWORKS: readonly AdsNetwork[] = ['adsense', 'baidu', 'custom'];

/**
 * A house (self-served) ad creative.
 *
 * House ads are the no-third-party fallback for the free tier: they render
 * locally from configuration, load no external script and contact no network,
 * so they stay usable while an ad-network account or ICP filing is pending.
 */
export interface HouseAd {
  id: string;
  placement: AdPlacement;
  title: string;
  body: string;
  href: string;
  cta: string;
}

export interface AdsConfig {
  enabled: boolean;
  network: AdsNetwork | null;
  clientId: string;
  scriptUrl: string;
  slots: Partial<Record<AdPlacement, string>>;
  house: HouseAd[];
  houseOnly: boolean;
}

export interface AdEligibility {
  known: boolean;
  tier: string;
}

const ADSENSE_SCRIPT_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Reads the public ad variables through literal member expressions.
 *
 * This matters: Next only inlines `process.env.NEXT_PUBLIC_*` at build time for
 * syntactic member access. A dynamic lookup such as `process.env[name]` is left
 * to a runtime `process.env` shim that is empty in the browser, which would
 * silently disable every ad slot in production.
 */
function readPublicEnv() {
  const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED;
  const network = process.env.NEXT_PUBLIC_ADS_NETWORK;
  const clientId = process.env.NEXT_PUBLIC_ADS_CLIENT_ID;
  const slotResult = process.env.NEXT_PUBLIC_ADS_SLOT_RESULT;
  const slotSidebar = process.env.NEXT_PUBLIC_ADS_SLOT_SIDEBAR;
  const scriptUrl = process.env.NEXT_PUBLIC_ADS_SCRIPT_URL;
  const houseJson = process.env.NEXT_PUBLIC_ADS_HOUSE_JSON;

  return {
    enabled: clean(enabled),
    network: clean(network),
    clientId: clean(clientId),
    slots: { result: clean(slotResult), sidebar: clean(slotSidebar) },
    scriptUrl: clean(scriptUrl),
    houseJson: clean(houseJson),
  };
}

function isPlacement(value: unknown): value is AdPlacement {
  return value === 'result' || value === 'sidebar';
}

/**
 * Parses the house-ad creatives. Anything malformed is dropped rather than
 * rendered, so a bad configuration degrades to "no ad" instead of a broken card.
 */
function parseHouseAds(raw: string): HouseAd[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const ads: HouseAd[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const placement = entry.placement;
    const title = clean(entry.title);
    const href = clean(entry.href);
    if (!isPlacement(placement) || !title || !href) continue;
    if (!/^(https?:\/\/|\/)/.test(href)) continue;
    ads.push({
      id: clean(entry.id) || `${placement}-${ads.length}`,
      placement,
      title,
      body: clean(entry.body),
      href,
      cta: clean(entry.cta),
    });
  }
  return ads;
}

function parseNetwork(value: string): AdsNetwork | null {
  const normalized = value.trim().toLowerCase();
  return (AD_NETWORKS as readonly string[]).includes(normalized) ? (normalized as AdsNetwork) : null;
}

/**
 * Reads the ad configuration. The channel stays disabled unless the flag is on,
 * the network is one we know how to load, and the script + slot that network
 * needs are actually configured.
 */
export function getAdsConfig(): AdsConfig {
  const raw = readPublicEnv();
  const flag = raw.enabled.toLowerCase();
  const requested = flag === 'true' || flag === '1';

  const network = parseNetwork(raw.network);
  const clientId = raw.clientId;
  const slots: Partial<Record<AdPlacement, string>> = {
    result: raw.slots.result,
    sidebar: raw.slots.sidebar,
  };
  const hasSlot = Object.values(slots).some(Boolean);

  const scriptUrl = raw.scriptUrl || (network === 'adsense' ? ADSENSE_SCRIPT_URL : '');

  const house = parseHouseAds(raw.houseJson);
  // A house creative needs no third-party account: it renders from configuration
  // and makes no external request, so it is allowed without script / slot ids.
  const houseOnly = network === 'custom' && house.length > 0;

  // AdSense needs a publisher id; the other networks are driven by their script.
  const configured = houseOnly
    ? true
    : network !== null &&
      hasSlot &&
      scriptUrl !== '' &&
      (network === 'adsense' ? clientId !== '' : true);

  return {
    enabled: requested && configured,
    network: requested && configured ? network : null,
    clientId,
    scriptUrl: houseOnly ? '' : scriptUrl,
    slots,
    house,
    houseOnly: requested && configured && houseOnly,
  };
}

/** The house creative for a placement, when the house channel is the active one. */
export function getHouseAd(config: AdsConfig, placement: AdPlacement): HouseAd | null {
  if (!config.houseOnly) return null;
  return config.house.find((ad) => ad.placement === placement) ?? null;
}

/**
 * Whether this placement has anything to render under the current channel:
 * either a configured network slot or a house creative.
 */
export function hasAdContent(config: AdsConfig, placement: AdPlacement): boolean {
  if (config.houseOnly) return getHouseAd(config, placement) !== null;
  return Boolean(config.slots[placement]);
}

/**
 * The single decision point for ad rendering.
 *
 * Returns false when ads are disabled, when the entitlement is unknown, or when
 * the viewer is anything other than a free-tier user.
 */
export function shouldShowAds(config: AdsConfig, eligibility: AdEligibility | null): boolean {
  if (!config.enabled) return false;
  if (!eligibility || eligibility.known !== true) return false;
  return eligibility.tier === 'free';
}
