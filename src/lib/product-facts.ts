export const PRODUCT_FACTS = {
  name: "DynaSaurus",
  chineseName: "词灵龙",
  creator: {
    name: "Kee Lee",
    role: "Founder & IELTS Coach",
    url: "https://rkrk.io",
  },
  canonicalUrl: "https://dynasaurus.rkrk.io",
  definition:
    "DynaSaurus (词灵龙) is Kee Lee’s personalized AI language-learning web app. It adapts vocabulary explanations, translation, grammar feedback, and IELTS speaking practice to a learner’s CEFR level, first language, and interests.",
  shortDescription:
    "Personalized AI language learning with a smart dictionary, translation, grammar feedback, and IELTS speaking practice.",
  coreModules: [
    {
      name: "Smart dictionary",
      description: "Personalized explanations built around the learner’s level, first language, and interests.",
    },
    {
      name: "Translation",
      description: "Language and cross-cultural guidance designed to explain why an expression works.",
    },
    {
      name: "Grammar feedback",
      description: "Corrections that explain the issue instead of returning only a rewritten sentence.",
    },
    {
      name: "IELTS speaking",
      description: "Practice prompts and structured support for developing speaking answers.",
    },
  ],
  rua: {
    name: "RUA",
    expansion: "Recognise, Understand, Apply",
    steps: [
      {
        name: "Recognise",
        description: "Identify meaning, form, pronunciation, and a useful core metaphor.",
      },
      {
        name: "Understand",
        description: "Explore collocations, contexts, connotations, and examples tied to familiar interests.",
      },
      {
        name: "Apply",
        description: "Use cross-linguistic mapping and level-appropriate practice to make the language usable.",
      },
    ],
  },
  interfaceLanguages: [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "es", name: "Español" },
    { code: "pt", name: "Português" },
    { code: "it", name: "Italiano" },
    { code: "ru", name: "Русский" },
  ],
  languageClaim: "The interface and learning profiles support 11 language settings.",
  cefrLevels: ["A1", "A2", "B1", "B2", "C1", "C2"],
  freeDailyLookups: 5,
  availability: {
    freePlan: true,
    paidCheckout: false,
    audioUpload: true,
    englishWordAudio: true,
    liveVoiceInput: false,
    aiVideoChat: false,
    videoDemos: false,
  },
  personaDisclosure:
    "Kai, Maya, and Alex are illustrative sample learner personas, not customer testimonials or measured learning outcomes.",
  lastReviewed: "2026-09-25",
} as const;

export type ProductFacts = typeof PRODUCT_FACTS;
