import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingNav from '@/components/MarketingNav';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: 'Privacy Policy',
  description:
    'How DynaSaurus handles your profile, lookup history, cookies, advertising and payments.',
  path: '/privacy',
});

const EFFECTIVE_DATE = '2026-09-15';

interface Section {
  title: string;
  titleZh: string;
  en: string;
  zh: string;
}

const SECTIONS: Section[] = [
  {
    title: 'What we collect',
    titleZh: '我们收集什么',
    en: 'Your learning profile (nickname, target language, level, background, hobbies and goal) is stored in this browser first, and synced to our database only when you sign in. Lookup history is kept locally and, for signed-in learners, in your account so it can follow you across devices. We also store a random device identifier used to unlock activation codes. Lookups (including anonymous ones) and KeeBot chat messages are logged in usage records, and IP addresses are processed to rate-limit abuse and keep the service available. To generate answers and transcripts, the content you submit (your profile, recent lookups and any audio) is sent to third-party AI providers for processing.',
    zh: '学习档案（昵称、目标语言、水平、背景、兴趣与目标）优先保存在本机浏览器；只有你登录后才会同步到我们的数据库。查词历史保存在本地；登录用户的记录会存进账号，以便跨设备使用。我们还会保存一个随机设备标识，用于激活码。查词记录（含未登录用户）与 KeeBot 对话会记入用量日志，我们也会处理 IP 地址用于限流与防止滥用，保障服务可用。为生成回答与转写，你提交的内容（档案、近期查词与音频）会发送给第三方 AI 服务商处理。',
  },
  {
    title: 'Cookies and local storage',
    titleZh: 'Cookie 与本地存储',
    en: 'We use browser storage for essentials: keeping you signed in, remembering your theme, language and preferences, and storing activation state. We do not sell your data, and we do not run third-party analytics profiles on you.',
    zh: '浏览器存储用于必要功能：保持登录状态、记住主题与语言偏好、保存激活状态。我们不出售你的数据，也不对你做第三方画像分析。',
  },
  {
    title: 'Advertising on the free plan',
    titleZh: '免费套餐中的广告',
    en: 'The free plan may show advertising from a third-party ad network (for example Google AdSense or a Chinese ad network). Those networks may set their own cookies to measure and personalise ads. Paid plans (Basic, Premium, Ultimate) and licensed accounts never load any ad code. You can limit ad personalisation in your browser or ad-network settings.',
    zh: '免费套餐可能展示来自第三方广告联盟（例如 Google AdSense 或国内广告联盟）的广告。这些联盟可能设置自己的 Cookie 以衡量和个性化广告。付费套餐（Basic / Premium / Ultimate）与已激活账号完全不加载任何广告代码。你可以在浏览器或广告联盟设置中限制广告个性化。',
  },
  {
    title: 'Payments',
    titleZh: '支付',
    en: 'Paid checkout is not currently enabled. Before any card, Alipay or WeChat Pay method goes live, we will update this policy with the active processor, the data it receives, and the subscription records retained by DynaSaurus.',
    zh: '目前尚未启用付费结账。在银行卡、支付宝或微信支付正式上线前，我们会更新本政策，说明实际使用的支付处理方、其接收的数据，以及 DynaSaurus 保留的订阅记录。',
  },
  {
    title: 'Storage, security and retention',
    titleZh: '存储、安全与保留',
    en: 'Data lives in managed cloud databases (Supabase) with row-level security. Access to billing and account records is limited to the operator. You can clear your local history at any time from the History panel, and you can ask us to delete your account data.',
    zh: '数据存放在托管云数据库（Supabase）中，并启用行级安全策略。账单与账号记录的访问权限仅限运营者。你可以随时在「History」面板清除本地历史，也可以要求我们删除账号数据。',
  },
  {
    title: 'Children',
    titleZh: '未成年人',
    en: 'DynaSaurus is a general-audience learning tool. Learners under 14 should use it with a parent or guardian, who is responsible for the account and any payment.',
    zh: 'DynaSaurus 面向一般学习者。14 岁以下用户在家长或监护人陪同下使用，账号与支付由监护人负责。',
  },
  {
    title: 'Contact',
    titleZh: '联系我们',
    en: 'Questions about your data, or a deletion request: reach Kee on WhatsApp (+44 7555 338741) or WeChat (keedahooman) — the same channels listed inside the app.',
    zh: '关于你的数据或删除请求：通过 WhatsApp（+44 7555 338741）或微信（keedahooman）联系 Kee，与应用内提供的联系方式一致。',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="mb-10">
          <div className="mb-3 text-4xl">🔒</div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            隐私政策 · Effective {EFFECTIVE_DATE} · applies to dynasaurus.rkrk.io
          </p>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-accent-warm)]">
                {section.title}
                <span className="ml-2 font-medium normal-case tracking-normal text-[var(--color-text-muted)]">
                  {section.titleZh}
                </span>
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{section.en}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">{section.zh}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs leading-6 text-[var(--color-text-muted)]">
          We will update this page before enabling any new data use (for example a new ad network) and
          will change the effective date above. 任何新的数据使用方式（例如新增广告联盟）上线前，我们都会先更新本页面。
        </p>

        <div className="mt-10">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            ← Back to DynaSaurus
          </Link>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
