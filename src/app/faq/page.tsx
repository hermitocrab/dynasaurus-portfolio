import JsonLd from "@/components/JsonLd";
import MarketingFooter from "@/components/MarketingFooter";
import MarketingNav from "@/components/MarketingNav";
import { PRODUCT_FACTS } from "@/lib/product-facts";
import { createPageMetadata, SITE_URL } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "DynaSaurus FAQ",
  description:
    "Answers about DynaSaurus, the RUA method, free usage, CEFR levels, language settings, accounts, accuracy, privacy, and IELTS practice.",
  path: "/faq",
});

const FAQS = [
  {
    question: "What is DynaSaurus?",
    answer: PRODUCT_FACTS.definition,
    questionZh: "DynaSaurus（词灵龙）是什么？",
    answerZh:
      "DynaSaurus（词灵龙）是由 Kee Lee 创建的个性化 AI 语言学习网页应用。它会根据学习者的 CEFR 等级、母语和兴趣，调整词汇解释、翻译、语法反馈与雅思口语练习。",
  },
  {
    question: "Who is DynaSaurus for?",
    answer:
      "It is for language learners who want explanations connected to their current level, first language, goals, and interests. It can also support learners preparing ideas and language for IELTS speaking practice.",
    questionZh: "DynaSaurus 适合谁？",
    answerZh:
      "它适合希望根据自身水平、母语、目标和兴趣获得个性化解释的语言学习者，也可用于准备雅思口语练习中的思路与表达。",
  },
  {
    question: "What does RUA mean?",
    answer:
      "RUA means Recognise, Understand, and Apply. DynaSaurus first identifies meaning, form, and pronunciation; then explores context, collocations, and connotations; and finally supports level-appropriate, cross-linguistic practice.",
    questionZh: "RUA 是什么意思？",
    answerZh:
      "RUA 代表 Recognise（识别）、Understand（理解）和 Apply（应用）：先识别含义、形式和发音，再理解语境、搭配和语气，最后进行符合水平的跨语言练习。",
  },
  {
    question: "How is it different from a standard dictionary?",
    answer:
      "A standard dictionary usually gives one published entry to every reader. DynaSaurus uses the learner profile to adapt the explanation and examples. It is AI-generated learning support, so important details should still be checked against an authoritative dictionary or teacher.",
    questionZh: "它与普通词典有什么不同？",
    answerZh:
      "普通词典通常向所有读者展示相同词条；DynaSaurus 会根据学习档案调整解释与例句。它提供 AI 生成的学习辅助，因此重要内容仍应通过权威词典或老师核对。",
  },
  {
    question: "Is DynaSaurus free?",
    answer: `Yes. The Free plan includes ${PRODUCT_FACTS.freeDailyLookups} lookups per day across the core modules. You can start without an account; signing in is used for features such as cloud history sync.`,
    questionZh: "DynaSaurus 免费吗？",
    answerZh: `免费套餐每天包含 ${PRODUCT_FACTS.freeDailyLookups} 次查询，可使用核心模块。无需账号即可开始；登录主要用于云端历史记录同步等功能。`,
  },
  {
    question: "Which CEFR levels are supported?",
    answer: `Learner profiles can be set from ${PRODUCT_FACTS.cefrLevels[0]} to ${PRODUCT_FACTS.cefrLevels.at(-1)}: ${PRODUCT_FACTS.cefrLevels.join(", ")}. The setting guides the level of explanations and practice; it is not an official proficiency assessment.`,
    questionZh: "支持哪些 CEFR 等级？",
    answerZh: `学习档案可选择 ${PRODUCT_FACTS.cefrLevels.join("、")}。该设置用于调整解释与练习难度，并不等同于正式语言能力测评。`,
  },
  {
    question: "Which languages does the interface support?",
    answer: `${PRODUCT_FACTS.languageClaim} They are ${PRODUCT_FACTS.interfaceLanguages.map(({ name }) => name).join(", ")}. This does not mean every speech or media feature has identical coverage in every language.`,
    questionZh: "界面支持哪些语言？",
    answerZh: `界面与学习档案支持 ${PRODUCT_FACTS.interfaceLanguages.length} 种语言设置：${PRODUCT_FACTS.interfaceLanguages.map(({ name }) => name).join("、")}。这不代表每种语言的语音或媒体功能覆盖完全相同。`,
  },
  {
    question: "Can DynaSaurus give an official IELTS score?",
    answer:
      "No. It can support IELTS speaking practice and answer development, but it is not an accredited IELTS examiner and does not issue official band scores.",
    questionZh: "DynaSaurus 能给出官方雅思分数吗？",
    answerZh: "不能。它可以辅助雅思口语练习与答案构思，但不是官方雅思考官，也不会签发正式分数。",
  },
  {
    question: "Are paid subscriptions available now?",
    answer:
      "No. The paid tiers are a plan preview and live checkout is not yet available. Stripe is in test mode, while Alipay and WeChat Pay are disabled. The working option today is the Free plan.",
    questionZh: "现在可以购买付费套餐吗？",
    answerZh:
      "暂时不能。付费套餐目前属于方案预览，正式结账尚未开放。Stripe 处于测试模式，支付宝与微信支付均未启用；当前可用的是免费套餐。",
  },
  {
    question: "Which audio and video features are available?",
    answer:
      "Audio-file upload for transcription and basic English word audio playback are available. Live voice input, AI video chat, and generated video demos are not currently shipped; roadmap items are not included as live capabilities.",
    questionZh: "目前有哪些音频和视频功能？",
    answerZh:
      "目前可使用音频文件上传转写和基础英文单词朗读。实时语音输入、AI 视频聊天与生成式视频示例尚未上线；路线图功能不视为现有能力。",
  },
  {
    question: "Can its AI answers be wrong?",
    answer:
      "Yes. AI output can be incomplete, outdated, or wrong. Verify exam-critical, specialist, legal, medical, or other high-stakes information with an appropriate authoritative source.",
    questionZh: "AI 回答会出错吗？",
    answerZh:
      "会。AI 输出可能不完整、过时或错误。与考试、专业、法律、医疗或其他高风险事项有关的信息，应通过适当的权威来源核实。",
  },
  {
    question: "How is learning data handled?",
    answer:
      "The learning profile and lookup history are stored in the browser first. For signed-in learners, selected data can sync to the account so history follows them across devices. See the Privacy Policy for the current details.",
    questionZh: "学习数据如何处理？",
    answerZh:
      "学习档案与查询历史会优先保存在浏览器中。登录后，部分数据可同步到账号，以便跨设备使用。最新详情请查看隐私政策。",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/faq#webpage`,
  url: `${SITE_URL}/faq`,
  name: "DynaSaurus FAQ",
  inLanguage: ["en", "zh-CN"],
  dateModified: PRODUCT_FACTS.lastReviewed,
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <JsonLd data={faqJsonLd} />
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent-warm)]">Help and product facts</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-6xl">
          Frequently asked questions
        </h1>
        <p lang="zh-CN" className="mt-3 text-lg text-[var(--color-text-muted)]">常见问题</p>

        <div className="mt-12 space-y-5">
          {FAQS.map((item) => (
            <article key={item.question} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 sm:p-7">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{item.question}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">{item.answer}</p>
              <div lang="zh-CN" className="mt-5 border-t border-[var(--color-border)] pt-5">
                <h3 className="font-bold text-[var(--color-text-primary)]">{item.questionZh}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">{item.answerZh}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-xs text-[var(--color-text-muted)]">Facts last reviewed: {PRODUCT_FACTS.lastReviewed}</p>
      </main>
      <MarketingFooter />
    </div>
  );
}
