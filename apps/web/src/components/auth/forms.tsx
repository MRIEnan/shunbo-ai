"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

const input = "h-11 w-full rounded-xl border border-ink/15 bg-cream px-4 text-sm outline-none focus:border-ink/40";
const primary = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-ink/80 bg-lavender text-sm font-medium shadow-[0_2px_0_0_rgba(26,26,26,0.8)] transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0";
const secondary = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-ink/20 text-sm font-medium hover:bg-ink/5";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

function Msg({ error, info }: { error?: string | null; info?: string | null }) {
  if (error) return <p className="rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm">{error}</p>;
  if (info) return <p className="rounded-xl bg-lavender p-3 text-sm">{info}</p>;
  return null;
}

function PasswordField({ value, onChange, placeholder = "Password", autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} required minLength={8} className={cn(input, "pr-11")} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Six separate boxes that behave like one input, with paste support. */
export function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const set = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d || " ";
    const joined = next.join("").replace(/\s+$/, "");
    onChange(joined.replace(/\D/g, ""));
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex justify-center gap-2" onPaste={(e) => { const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(5, t.length)]?.focus(); } }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => set(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => { if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus(); }}
          aria-label={`Digit ${i + 1}`}
          className="h-14 w-11 rounded-xl border border-ink/15 bg-cream text-center text-2xl font-semibold outline-none focus:border-ink/50"
        />
      ))}
    </div>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await post("/api/account/signup", { email, password });
          if (r.verified) {
            const res = await signIn("credentials", { email, password, redirect: false });
            if (res?.error) throw new Error("Password saved. Please sign in.");
            router.push("/app");
          } else {
            router.push(`/verify?email=${encodeURIComponent(email)}`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Sign up failed");
          setBusy(false);
        }
      }}
    >
      <Msg error={error} />
      <label className="text-sm font-medium" htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className={input} />
      <label className="text-sm font-medium" htmlFor="password">Password</label>
      <PasswordField value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
      <button type="submit" disabled={busy} className={cn(primary, "mt-2")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Create account
      </button>
      <p className="mt-2 text-center text-xs text-ink/60">We&rsquo;ll email you a 6-digit code to confirm your address.</p>
    </form>
  );
}

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl")?.startsWith("/") ? params.get("callbackUrl")! : "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(params.get("reset") === "1" ? "Password updated. Sign in with your new password." : null);

  const withPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("password");
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (!res || res.error) {
      const code = res?.code ?? "";
      if (code === "unverified") {
        await post("/api/account/resend", { email, purpose: "verify" }).catch(() => null);
        router.push(`/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      setError(code === "no_password" ? "This account has no password yet. Use the sign-in link below, or reset your password." : "Incorrect email or password.");
      setBusy(null);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  const withLink = async () => {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setBusy("link");
    setError(null);
    await signIn("nodemailer", { email, redirectTo: callbackUrl });
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={withPassword}>
      <Msg error={error} info={info} />
      <label className="text-sm font-medium" htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setInfo(null); }} required autoComplete="email" placeholder="you@example.com" className={input} />
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <Link href={`/forgot${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-xs text-ink/60 underline">Forgot password?</Link>
      </div>
      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
      <button type="submit" disabled={busy !== null} className={cn(primary, "mt-2")}>
        {busy === "password" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Sign in
      </button>
      <div className="my-1 flex items-center gap-3 text-xs text-ink/60"><span className="h-px flex-1 bg-ink/10" />or<span className="h-px flex-1 bg-ink/10" /></div>
      <button type="button" onClick={withLink} disabled={busy !== null} className={secondary}>
        {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Email me a sign-in link
      </button>
      <p className="mt-3 text-center text-sm text-ink/60">
        New here? <Link href="/signup" className="underline">Create an account</Link>
      </p>
    </form>
  );
}

export function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/app";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setBusy("verify");
    setError(null);
    try {
      await post("/api/account/verify", { email, code });
      if (password) {
        const res = await signIn("credentials", { email, password, redirect: false });
        if (!res?.error) {
          router.push(next);
          router.refresh();
          return;
        }
      }
      setNeedPassword(true);
      setInfo("Email verified. Enter your password to continue.");
      setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setBusy(null);
    }
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("verify");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Incorrect password.");
      setBusy(null);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const autoSubmitted = useRef("");
  useEffect(() => {
    if (code.length === 6 && autoSubmitted.current !== code && !busy && !needPassword) {
      autoSubmitted.current = code;
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setBusy("resend");
    setError(null);
    try {
      await post("/api/account/resend", { email, purpose: "verify" });
      setInfo("A new code is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend");
    }
    setBusy(null);
  };

  if (needPassword) {
    return (
      <form className="flex flex-col gap-3" onSubmit={finish}>
        <Msg error={error} info={info} />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={busy !== null} className={primary}>{busy ? <Loader2 className="size-4 animate-spin" /> : null} Continue</button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <Msg error={error} info={info} />
      <CodeInput value={code} onChange={setCode} autoFocus />
      <button type="submit" disabled={busy !== null || code.length !== 6} className={primary}>
        {busy === "verify" ? <Loader2 className="size-4 animate-spin" /> : null} Verify
      </button>
      <button type="button" onClick={resend} disabled={busy !== null} className="text-sm text-ink/60 underline">
        {busy === "resend" ? "Sending…" : "Resend code"}
      </button>
    </form>
  );
}

export function ForgotForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await post("/api/account/resend", { email, purpose: "reset" });
          router.push(`/reset?email=${encodeURIComponent(email)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't send the code");
          setBusy(false);
        }
      }}
    >
      <Msg error={error} />
      <label className="text-sm font-medium" htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" className={input} />
      <button type="submit" disabled={busy} className={cn(primary, "mt-2")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Send reset code
      </button>
      <p className="mt-3 text-center text-sm text-ink/60"><Link href="/signin" className="underline">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"reset" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy("reset");
        setError(null);
        try {
          await post("/api/account/reset", { email, code, password });
          router.push("/signin?reset=1");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Reset failed");
          setBusy(null);
        }
      }}
    >
      <Msg error={error} info={info} />
      <CodeInput value={code} onChange={setCode} autoFocus />
      <label className="text-sm font-medium" htmlFor="password">New password</label>
      <PasswordField value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
      <button type="submit" disabled={busy !== null || code.length !== 6 || password.length < 8} className={primary}>
        {busy === "reset" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Set new password
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={async () => {
          setBusy("resend");
          try {
            await post("/api/account/resend", { email, purpose: "reset" });
            setInfo("A new code is on its way.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't resend");
          }
          setBusy(null);
        }}
        className="text-sm text-ink/60 underline"
      >
        {busy === "resend" ? "Sending…" : "Resend code"}
      </button>
    </form>
  );
}
