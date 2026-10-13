export const BRAND = {
  name: "Shunbo",
  fullName: "Shunbo AI",
  tagline: "Don't type, just speak.",
  cta: "Get started on Windows",
  platforms: "Available on Windows, Mac, and the web.",
};

export const HERO = {
  eyebrow: "Shunbo Dictation",
  sub: "The voice-to-text AI that turns speech into clear, polished writing in every app.",
  messy:
    "Umm, hey so, I was talking to Priya earlier but the reception was really bad and I think their gonna handle the the first part of the project, but I'm not totally sure. Also, I told the team the the new timeline should be ready by Friday, although it's probably gonna slip. There's been a lot of back and forth and honestly the whole thing's been kind of chaotic, like nobody really knows what's going on, so can you check in with them and see if the notes from yesterday's meeting were sent out?",
  clean:
    "Hey, I was talking to Priya earlier, but the reception was really bad. I think they're going to handle the first part of the project, but I'm not totally sure. I also told the team the new timeline should be ready by Friday, although it might slip. There's been a lot of back and forth, and honestly, the whole thing has been a bit chaotic. Can you check in with them and see if the notes from yesterday's meeting were sent out?",
};

export const LOGOS = [
  "Northwind",
  "Lumen Labs",
  "Harbor",
  "Vertex",
  "Pioneer",
  "Meridian",
  "Atlas Health",
  "Orbit",
  "Fathom",
  "Juniper",
];

export const SPEED = {
  sub: "Voice that finally works is here. Shunbo lets you create, code, message, and write at the speed of thought, 4x faster than your keyboard.",
  sample:
    "I'm getting started with the project. How would you like to set up the file? I can create a new one from scratch, or pull in something you're already working with. What sounds good? Cool, give me a sec... Alright, got the structure ready. Want to walk me through what you're building, or start with a template? Up to you, I'll follow your lead. ",
};

export type Token = { t: string; k?: "filler" | "correction" | "repeat" };

export const RAW_TOKENS: Token[] = [
  { t: "Hey so " },
  { t: "um ", k: "filler" },
  { t: "can you " },
  { t: "actually wait ", k: "correction" },
  { t: "can you tell the team that " },
  { t: "the ", k: "repeat" },
  { t: "the launch is gonna slip " },
  { t: "I think to like ", k: "filler" },
  { t: "not Friday ", k: "correction" },
  { t: "the following Monday because we're still waiting on " },
  { t: "uh ", k: "filler" },
  { t: "legal to sign off on " },
  { t: "the ", k: "repeat" },
  { t: "the new terms page and " },
  { t: "uh yeah ", k: "filler" },
  { t: "just let them know we'll have a real timeline by " },
  { t: "by ", k: "repeat" },
  { t: "end of week " },
  { t: "sorry ", k: "correction" },
  { t: "end of day Thursday" },
];

export const CLEAN_MESSAGE =
  "Can you let the team know the launch is slipping to Monday? We're still waiting on legal to sign off on the new terms page. We'll have a firm timeline by end of day Thursday.";

export const HOW_STEPS = [
  {
    title: "Speak naturally",
    body: "Ramble, pause, or change your mind mid-sentence. Shunbo understands what you mean, not just what you say.",
  },
  {
    title: "Shunbo edits as you speak",
    body: "Text that reads like you wrote it, not like you spoke it. Shunbo automatically removes filler words, adds punctuation, and formats your writing.",
  },
  {
    title: "Use it anywhere",
    body: "Shunbo works anywhere you can type, with no plugins required. Syncs seamlessly across Windows, Mac, and the web.",
  },
];

export const FEATURES = {
  eyebrow: "Shunbo makes it easy",
  languages: {
    title: "100+ Languages",
    body: "Shunbo automatically detects and transcribes the language you're speaking, so you can switch between languages naturally.",
    samples: [
      { lang: "English", flag: "🇬🇧", text: "I'm getting started with the project. Here are a few options." },
      { lang: "Deutsch", flag: "🇩🇪", text: "Wie möchten Sie die Datei einrichten? Hier sind ein paar Optionen." },
      { lang: "Español", flag: "🇪🇸", text: "Estoy empezando con el proyecto. Aquí van algunas opciones." },
      { lang: "বাংলা", flag: "🇧🇩", text: "প্রজেক্টের কাজ শুরু হয়ে গেছে। এখানে কয়েকটি বিকল্প আছে।" },
      { lang: "日本語", flag: "🇯🇵", text: "プロジェクトを始めました。いくつかの選択肢があります。" },
    ],
  },
  vocabulary: {
    title: "Shunbo learns your vocabulary",
    body: "Shunbo learns your unique words and names automatically, or lets you add them yourself. From client names to company jargon, it gets the details right.",
    names: ["Priya", "Aditya", "Dillon"],
  },
  snippets: {
    title: "Save your most used text",
    body: "Create snippets for the things you type all the time, like emails, links, addresses, and bios. Speak the shortcut, and Shunbo expands it instantly.",
  },
  tone: {
    title: "Make Shunbo sound like you",
    body: "Shunbo adapts to how you write in different apps. Set a different style for messages, work chats, emails, and more.",
    options: [
      { label: "Formal", text: "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you." },
      { label: "Casual", text: "Hey are you free for lunch tomorrow? Let's do 12 if that works for you" },
      { label: "Very casual", text: "hey are you free for lunch tomorrow? let's do 12 if that works for you" },
    ],
  },
};

export const PRIVACY = {
  heading: "Your voice stays yours.",
  body: "Your data is never sold. You choose whether data is used to help improve Shunbo. SOC 2 Type II, HIPAA and ISO 27001 ready.",
};

// Placeholder testimonials for the demo site. Replace with real customer quotes before launch.
export const CASE_STUDY = {
  name: "Maya Okafor",
  role: "Host of The Builder's Desk",
  quote:
    "The thought I have becomes my explanation. The gap between my thought and my delivery of my idea collapses.",
  stats: [
    { value: "90%", label: "faster message output" },
    { value: "2", label: "extra productive hours/day" },
  ],
};

export const QUOTES = [
  {
    quote:
      "If you find it tiring to write long emails, or just need something quick to note down an idea in the heat of the moment, this app is a godsend.",
    name: "Tech Weekly",
    role: "Editorial review",
  },
  {
    quote:
      "Shunbo is a top 3 favorite AI tool for me. I literally do not use my fingers to type anymore.",
    name: "Alex Rivera",
    role: "Co-founder, Morning Signal",
  },
  {
    quote:
      "I feel like I have no time to type anymore. So I just talk to my phone and my laptop all the time.",
    name: "Elena Marsh",
    role: "Head of Growth, Buildable",
  },
  {
    quote:
      "Shunbo just gets it right. It is consistently so much better than the standard voice input, it'll blow your mind.",
    name: "Product Daily",
    role: "Editorial review",
  },
  {
    quote:
      "Dictation has always felt like magic. With Notetaker, that magic has gone multiplayer with perfectly formatted notes and summaries that are actually useful.",
    name: "Dave Lin",
    role: "CEO, Warbler",
  },
];

export const FAQS = [
  {
    q: "Will Shunbo work in my messages, notes, email, or AI tools?",
    a: "Yes. Shunbo works in any text field on your computer, including Slack, Gmail, Notion, VS Code, ChatGPT, and your browser. No plugins or integrations are needed.",
  },
  {
    q: "How is Shunbo different from Siri or Google voice typing?",
    a: "Built-in dictation writes down exactly what you say, filler words and all. Shunbo understands what you mean, removes the ums and repeats, fixes punctuation, and formats the result so it reads like you typed it.",
  },
  {
    q: "Does Shunbo work in other languages?",
    a: "Shunbo supports more than 100 languages and automatically detects the one you're speaking. You can switch between languages mid-sentence.",
  },
  {
    q: "Does it work if I have an accent?",
    a: "Yes. Shunbo is trained on a wide range of accents and dialects, and it learns how you speak over time.",
  },
  {
    q: "What if I talk fast, speak quietly, or work somewhere noisy?",
    a: "Shunbo handles fast speech and quiet voices well, and it filters out background noise from cafés, offices, and open-plan spaces.",
  },
  {
    q: "Do I need a special microphone or extra hardware?",
    a: "No. Your laptop's built-in microphone or any headset works great.",
  },
  {
    q: "Is my voice data private?",
    a: "Your audio is processed securely and never sold. You control whether your data is used to improve Shunbo, and you can delete your history at any time.",
  },
  {
    q: "Is Shunbo free?",
    a: "Shunbo has a free plan with a weekly word limit, and a Pro plan with unlimited dictation. Teams can get volume pricing on the Business plan.",
  },
  {
    q: "Can my whole team use it?",
    a: "Yes. The Business plan adds centralized billing, shared vocabulary, and admin controls.",
  },
  {
    q: "Does Shunbo have an AI Notetaker for meetings?",
    a: "Yes. Shunbo Notetaker joins your meetings, transcribes them, and produces formatted notes and summaries. It is included with Dictation in one subscription.",
  },
];

export const FINAL_CTA = {
  heading: "You have a way with words. Now, two.",
  body: "Talk thoughts into writing with Shunbo and conversations into meeting notes with Notetaker. Both are now included in one subscription.",
};

export const FOOTER = [
  {
    title: "Product",
    links: ["Download free", "Pricing", "Privacy & Security", "Web demo", "Shunbo vs. built-in dictation", "Microphone guide"],
  },
  {
    title: "Use cases",
    links: ["Leaders", "Developers", "Creators", "Customer support", "Students", "Lawyers", "Accessibility", "Sales"],
  },
  {
    title: "Resources",
    links: ["Case studies", "Blog", "AI prompting guide", "Workflows", "What's new", "Vibe coding", "Bug bounty"],
  },
  {
    title: "Company",
    links: ["Talk to support", "Talk to sales", "Help center", "About", "Careers", "Trust center", "Become an affiliate"],
  },
];
