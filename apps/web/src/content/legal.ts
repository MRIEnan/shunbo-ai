export const LEGAL = {
  company: "Shunbo AI",
  domain: "shunboai.com",
  contactEmail: "enan.mainur@gmail.com",
  updated: "13 October 2026",
};

export type LegalSection = { heading: string; body: string[] };

export const PRIVACY: LegalSection[] = [
  {
    heading: "What we collect",
    body: [
      "Account information: your email address, a hashed password (we never store the password itself), and verification codes that expire within 10 minutes.",
      "Audio: when you hold the dictation shortcut, press the microphone button, or start a meeting recording, Shunbo captures audio from your microphone and, for meeting recordings only, the audio playing on your computer. Audio is sent to our servers for transcription and is deleted immediately after it is transcribed. We do not store audio recordings.",
      "Transcripts and notes: the text produced from your audio (dictations, meeting transcripts, and generated summaries, action items and decisions) is stored in your account so you can review, copy, export and delete it.",
      "Settings you choose: vocabulary words, text snippets, style presets, language and shortcut preferences.",
      "Usage and billing data: word counts and meeting minutes used for plan limits; subscription status and a Stripe customer identifier if you upgrade. Payment card details are entered on Stripe's pages and never reach our servers.",
      "Technical data: server request logs (IP address, timestamps, request outcomes) for security and rate limiting. The desktop app keeps a local log file on your computer, which is only shared with us if you copy it into a support request.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To provide the Service: transcribe speech, clean it up, generate notes, type text where you ask, and sync your settings and history across devices.",
      "To run your account: sign-in emails, verification codes, password resets, plan limits and billing.",
      "To keep the Service secure and reliable: abuse prevention, rate limiting, and troubleshooting.",
      "We do not sell your data, and we do not use your audio or transcripts to train our own models. Your content is used only to produce your results.",
    ],
  },
  {
    heading: "Third parties that process data for us",
    body: [
      "OpenAI receives audio for transcription and transcript text for cleanup and note generation. Under OpenAI's API terms, data sent through the API is not used to train their models.",
      "Stripe handles payments and subscription billing.",
      "Our email provider delivers sign-in links, verification codes and password-reset codes.",
      "Our hosting and database providers store account data, transcripts and notes.",
      "Each processes data only to provide its service to us.",
    ],
  },
  {
    heading: "Meeting recordings and consent",
    body: [
      "The Notetaker feature records your microphone and the audio playing on your computer, which can include other people on a call. Laws on recording conversations vary by place, and in many jurisdictions everyone on the call must consent.",
      "You are responsible for telling participants that a meeting is being recorded and for obtaining any consent the law requires. Shunbo shows a visible recording indicator and asks you to acknowledge this before your first recording.",
    ],
  },
  {
    heading: "Retention and deletion",
    body: [
      "Audio: deleted right after transcription, usually within minutes.",
      "Transcripts, notes and dictations: kept until you delete them or delete your account. You can delete individual items from History and Meetings at any time.",
      "Account data: deleted when you delete your account, except billing records we must keep for tax and accounting purposes.",
      "Server logs: kept for up to 30 days.",
      "To delete your account, contact us at the address below and we will remove it within 30 days.",
    ],
  },
  {
    heading: "Security",
    body: [
      "Passwords are stored as salted hashes. Verification codes and desktop sign-in tokens are stored hashed and can be revoked. Data is encrypted in transit.",
      "No system is perfectly secure, so please use a strong, unique password.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Depending on where you live, you may have the right to access, correct, export or delete your personal data, or to object to certain processing. Email us and we will respond within 30 days.",
      "If you are in the EU or UK, you may also complain to your local data protection authority.",
    ],
  },
  {
    heading: "Children",
    body: ["Shunbo is not intended for children under 16, and we do not knowingly collect their data. If you believe a child has created an account, contact us and we will delete it."],
  },
  {
    heading: "Changes",
    body: ["We may update this policy as the Service changes. We will post the new version here with a new “Last updated” date, and notify you by email for material changes."],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: "The service",
    body: [
      "Shunbo provides voice dictation and meeting-notes software through shunboai.com, a web app and a Windows desktop app. By creating an account or using the software you agree to these terms.",
      "You must be at least 16 years old and provide accurate account information. You are responsible for keeping your password and devices secure.",
    ],
  },
  {
    heading: "Plans and billing",
    body: [
      "The Free plan includes a weekly word allowance and a monthly meeting-minute allowance shown on the pricing page. Paid plans renew monthly until cancelled and are billed through Stripe.",
      "You can cancel at any time from the billing portal; access continues until the end of the paid period. Fees are non-refundable except where required by law.",
      "We may change prices with at least 30 days' notice by email.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "You own the audio you record and the text Shunbo produces from it. You grant us only the rights needed to process it for you, as described in the Privacy Policy.",
      "You are responsible for the content you dictate and record, including obtaining consent from meeting participants where the law requires it.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not use Shunbo to record people without the consent the law requires, to infringe others' rights, to send spam, or to attack, overload or reverse-engineer the Service.",
      "We may suspend or close accounts that break these terms.",
    ],
  },
  {
    heading: "Accuracy",
    body: [
      "Transcription and notes are produced by automated systems and can contain errors. Review important text before relying on it. Shunbo is not a substitute for professional, legal or medical advice.",
    ],
  },
  {
    heading: "Availability and liability",
    body: [
      "We aim for high availability but do not guarantee uninterrupted service. The Service is provided “as is”. To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.",
    ],
  },
  {
    heading: "Termination",
    body: ["You can delete your account at any time. We may terminate accounts for breach of these terms. Sections on content, liability and disputes survive termination."],
  },
  {
    heading: "Changes and contact",
    body: ["We may update these terms and will notify you of material changes by email. Questions: see the contact address below."],
  },
];
