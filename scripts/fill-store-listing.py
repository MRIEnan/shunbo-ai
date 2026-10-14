"""Fills the Partner Center store-listing CSV template with Shunbo's listing copy.

Usage: python scripts/fill-store-listing.py "<template.csv>" "<output.csv>"
Screenshot/logo file names are relative to the CSV's folder; copy the files from
store-assets/ next to the output CSV before uploading.
"""
import csv
import sys

template, output = sys.argv[1], sys.argv[2]

DESCRIPTION = """Shunbo turns your voice into clean, polished text in any app, and turns your meetings into notes you can act on.

DICTATE ANYWHERE
Hold Ctrl + Shift + Space, say what you mean, let go. Shunbo removes the ums and false starts, fixes punctuation, applies the tone you want, and pastes the result right where your cursor is: Slack, Gmail, Notion, VS Code, Word, a browser form, anything with a text box. Speak at the speed you think instead of typing at 45 words a minute.

MEETING NOTES THAT WRITE THEMSELVES
Start Notetaker before a call on Zoom, Teams, Meet or any other app. Shunbo records your microphone and what you hear, labels who said what, and when you stop it delivers a summary, action items with owners, decisions and open questions, plus the full searchable transcript. Export to Markdown or copy straight into your tools.

MADE FOR HOW YOU WORK
• 100+ languages with automatic detection; switch languages mid-sentence.
• Your vocabulary: client names, product names and jargon are spelled right.
• Snippets: say "my LinkedIn" and the link appears.
• Style per app: formal in email, relaxed in chat. Shunbo notices which app is active.
• A visible recording indicator and a one-time consent notice for meetings.

PRIVATE BY DESIGN
Audio is sent to Shunbo only while you hold the shortcut or record a meeting, is transcribed, then deleted. Transcripts and notes live in your account and can be deleted anytime. We never sell your data.

PLANS
Free includes 2,000 dictated words per week and 60 meeting minutes per month. Pro removes the limits. Create an account at shunbo-ai.vercel.app.

Shunbo is a Windows desktop app. A microphone is required; headphones or speakers are needed for Notetaker. An internet connection is required."""

WHATS_NEW = """0.3.2
• Sign-in from the app now opens your browser reliably, with a manual fallback.
• New setup wizard: microphone check, system-audio check, shortcut test and recording consent.
• Diagnostics panel with a one-click report for support.
• Notetaker: more reliable chunk uploads with automatic retries.
• Closing the window asks whether to keep Shunbo in the tray or quit."""

FEATURES = [
    "Hold a shortcut, speak, release: polished text is typed into any app",
    "Removes filler words, false starts and repeats; fixes punctuation automatically",
    "Notetaker records any call and labels who said what",
    "Meeting summary, action items, decisions and open questions in seconds",
    "100+ languages with automatic detection",
    "Custom vocabulary for names, products and jargon",
    "Snippets: say a short phrase, insert the full text",
    "Different writing style per app: formal in email, casual in chat",
    "Searchable history of dictations and meetings, Markdown export",
    "Visible recording indicator and consent notice for meetings",
    "Audio is deleted right after transcription; nothing is sold",
    "Runs quietly in the system tray",
]

SHORT = "Don't type, just speak. Dictate polished text into any app and get AI notes from every meeting."

SEARCH = ["voice to text", "dictation", "speech to text", "meeting notes", "transcription", "AI notetaker", "voice typing"]

LICENSE = "By installing Shunbo you agree to the Shunbo Terms of Service (https://shunbo-ai.vercel.app/terms) and Privacy Policy (https://shunbo-ai.vercel.app/privacy)."
COPYRIGHT = "© 2026 Shunbo AI. All rights reserved."
DEVELOPED_BY = "Shunbo AI"

REQ_MIN = [
    "OS: Windows 10 version 1803 or later, or Windows 11 (64-bit)",
    "Processor: x64, 1 GHz or faster",
    "Memory: 4 GB RAM",
    "Microphone: required for dictation",
    "Internet connection: required",
    "WebView2 Runtime (included with Windows 11; installed automatically on Windows 10)",
]
REQ_REC = [
    "OS: Windows 11 (64-bit)",
    "Processor: x64, 2 GHz or faster",
    "Memory: 8 GB RAM",
    "Headset with microphone, or speakers plus microphone, for meeting recording",
    "Broadband internet connection",
]

LOGOS = ["shunbo-logo-1080.png", "shunbo-logo-300.png"]
SCREENSHOTS = ["01-home.png", "02-how-it-works.png", "03-notetaker.png", "04-dictate.png", "05-settings.png", "06-record-meeting.png"]

values = {
    "ProductName": "Shunbo AI: Voice to Text",
    "Description": DESCRIPTION,
    "WhatsNew": WHATS_NEW,
    "ShortDescription": SHORT,
    "Applicable license terms": LICENSE,
    "Copyright": COPYRIGHT,
    "DevelopedBy": DEVELOPED_BY,
    "HeroArts": "",
    "Trailers": "",
}
for i, f in enumerate(FEATURES, 1):
    values[f"ProductFeatures{i}"] = f
for i, s in enumerate(SEARCH, 1):
    values[f"SearchTerms{i}"] = s
for i, r in enumerate(REQ_MIN, 1):
    values[f"RequirementsMinimum{i}"] = r
for i, r in enumerate(REQ_REC, 1):
    values[f"RequirementsRecommended{i}"] = r
for i, l in enumerate(LOGOS, 1):
    values[f"StoreLogos{i}"] = l
for i, s in enumerate(SCREENSHOTS, 1):
    values[f"Screenshots{i}"] = s

with open(template, encoding="utf-8-sig", newline="") as f:
    rows = list(csv.reader(f))
header, body = rows[0], rows[1:]
filled = 0
for row in body:
    while len(row) < 3:
        row.append("")
    if row[0] in values:
        row[2] = values[row[0]]
        if values[row[0]]:
            filled += 1
with open(output, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(header)
    w.writerows(body)
print(f"wrote {output} ({filled} fields filled)")
