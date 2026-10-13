import { createHash, randomInt } from "node:crypto";
import { createTransport } from "nodemailer";
import { prisma } from "@/lib/prisma";

export type CodePurpose = "verify" | "reset";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;

const hash = (email: string, purpose: CodePurpose, code: string) =>
  createHash("sha256").update(`${email.toLowerCase()}|${purpose}|${code}`).digest("hex");

export const smtpConfig = () => ({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: Number(process.env.SMTP_PORT ?? 465) === 465,
  auth: { user: process.env.GMAIL_USER ?? "", pass: process.env.GMAIL_APP_PASSWORD ?? "" },
});

export const mailFrom = () => process.env.SMTP_FROM ?? process.env.GMAIL_USER ?? "";

function codeEmailHtml(code: string, purpose: CodePurpose, link?: string) {
  const heading = purpose === "verify" ? "Verify your email" : "Reset your password";
  const intro =
    purpose === "verify"
      ? "Enter this code in Shunbo to finish creating your account."
      : "Enter this code in Shunbo to choose a new password. If you didn't ask for this, ignore this email.";
  return `<!doctype html><html><body style="margin:0;background:#ffffeb;font-family:Figtree,Arial,sans-serif;color:#1a1a1a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffdf9;border:1px solid rgba(26,26,26,.1);border-radius:24px;padding:36px">
      <tr><td style="font-size:20px;font-weight:600">Shunbo</td></tr>
      <tr><td style="padding-top:20px;font-size:28px;font-family:'EB Garamond',Georgia,serif">${heading}</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#444">${intro}</td></tr>
      <tr><td style="padding-top:24px"><div style="display:inline-block;font-size:32px;letter-spacing:10px;font-weight:600;background:#f0d7ff;border-radius:16px;padding:14px 22px">${code}</div></td></tr>
      <tr><td style="padding-top:16px;font-size:13px;color:#666">The code expires in 10 minutes.</td></tr>
      ${link ? `<tr><td style="padding-top:20px;font-size:13px;color:#666">Or <a href="${link}" style="color:#034f46">open this link</a> on the same device.</td></tr>` : ""}
    </table>
  </td></tr></table></body></html>`;
}

/** Creates a fresh code (invalidating older ones) and emails it. Enforces a resend cooldown. */
export async function sendCode(email: string, purpose: CodePurpose, link?: string) {
  const normalized = email.toLowerCase();
  const recent = await prisma.emailCode.findFirst({ where: { email: normalized, purpose }, orderBy: { createdAt: "desc" } });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
    throw new Error(`Please wait ${wait}s before requesting another code.`);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.emailCode.deleteMany({ where: { email: normalized, purpose } }),
    prisma.emailCode.create({ data: { email: normalized, purpose, codeHash: hash(normalized, purpose, code), expires: new Date(Date.now() + CODE_TTL_MS) } }),
  ]);
  if (process.env.NODE_ENV !== "production") console.log(`[dev] ${purpose} code for ${normalized}: ${code}`);
  const transport = createTransport(smtpConfig());
  await transport.sendMail({
    to: normalized,
    from: mailFrom(),
    subject: purpose === "verify" ? `${code} is your Shunbo verification code` : `${code} is your Shunbo password reset code`,
    text: `${purpose === "verify" ? "Verify your email" : "Reset your password"}\n\nYour code: ${code}\nIt expires in 10 minutes.${link ? `\n\nOr open: ${link}` : ""}`,
    html: codeEmailHtml(code, purpose, link),
  });
}

/** Checks a code. Consumes it on success; counts attempts and locks after too many. */
export async function verifyCode(email: string, purpose: CodePurpose, code: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const normalized = email.toLowerCase();
  const row = await prisma.emailCode.findFirst({ where: { email: normalized, purpose }, orderBy: { createdAt: "desc" } });
  if (!row) return { ok: false, reason: "No code was sent to this address. Request a new one." };
  if (row.expires.getTime() < Date.now()) return { ok: false, reason: "That code has expired. Request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "Too many attempts. Request a new code." };
  if (row.codeHash !== hash(normalized, purpose, code.trim())) {
    await prisma.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: `Incorrect code. ${MAX_ATTEMPTS - row.attempts - 1} attempt(s) left.` };
  }
  await prisma.emailCode.deleteMany({ where: { email: normalized, purpose } });
  return { ok: true };
}
