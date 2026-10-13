import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createTransport } from "nodemailer";
import { prisma } from "@/lib/prisma";

const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const smtp = {
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: smtpPort,
  // Implicit TLS only on 465; 587 and 25 use STARTTLS (secure: false). Ignore SMTP_SECURE when it contradicts the port.
  secure: smtpPort === 465,
  auth: {
    user: process.env.GMAIL_USER ?? "",
    pass: process.env.GMAIL_APP_PASSWORD ?? "",
  },
};

function magicLinkHtml(url: string, host: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffeb;font-family:Figtree,Arial,sans-serif;color:#1a1a1a">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffdf9;border:1px solid rgba(26,26,26,.1);border-radius:24px;padding:36px">
      <tr><td style="font-size:20px;font-weight:600">Shunbo</td></tr>
      <tr><td style="padding-top:20px;font-size:28px;font-family:'EB Garamond',Georgia,serif">Sign in to Shunbo</td></tr>
      <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#444">Click the button below to sign in to <strong>${host}</strong>. This link expires in 24 hours and can only be used once.</td></tr>
      <tr><td style="padding-top:28px"><a href="${url}" style="display:inline-block;background:#f0d7ff;color:#1a1a1a;border:1px solid #1a1a1a;border-radius:999px;padding:12px 24px;font-weight:600;text-decoration:none">Sign in</a></td></tr>
      <tr><td style="padding-top:28px;font-size:12px;color:#777">If you didn't request this email, you can safely ignore it.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email", error: "/signin" },
  providers: [
    Nodemailer({
      server: smtp,
      from: process.env.SMTP_FROM ?? process.env.GMAIL_USER,
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url, provider }) {
        const { host } = new URL(url);
        const transport = createTransport(provider.server);
        const result = await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Sign in to Shunbo`,
          text: `Sign in to Shunbo\n\nOpen this link to sign in to ${host}:\n${url}\n\nIf you didn't request this, ignore this email.`,
          html: magicLinkHtml(url, host),
        });
        const failed = result.rejected.concat(result.pending).filter(Boolean);
        if (failed.length) throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
