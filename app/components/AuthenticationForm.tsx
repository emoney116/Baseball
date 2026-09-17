"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp";
import { emailAuth } from "../lib/emailAuthClient";
import { authErrorMessage, EMAIL_CODE_LENGTH, RESEND_COOLDOWN_SECONDS, type EmailAuthService } from "../lib/emailAuth";
import { createClient } from "../lib/supabase/client";
import { BusyIndicator } from "./AppLoading";

type Step = "login" | "signup" | "verify" | "forgot" | "reset-sent";
export function AuthenticationForm({ onSignedIn, initialEmail = "", lockedEmail = false, next = "/", service = emailAuth, initialStep = "login" }: {
  onSignedIn: () => void | Promise<void>; initialEmail?: string; lockedEmail?: boolean; next?: string;
  service?: EmailAuthService; initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(0);
  const resendAt = useRef(0);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const onSignedInRef = useRef(onSignedIn);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { onSignedInRef.current = onSignedIn; }, [onSignedIn]);
  useEffect(() => { titleRef.current?.focus(); }, [step]);
  useEffect(() => {
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);
  function cooldown() { resendAt.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000; setRemaining(RESEND_COOLDOWN_SECONDS); }
  async function finish() {
    if (completed.current) return;
    completed.current = true;
    setPassword(""); setConfirmPassword(""); setCode("");
    try { await onSignedInRef.current(); } catch (error) { completed.current = false; throw error; }
  }
  useEffect(() => {
    if (step !== "verify" || service !== emailAuth) return;
    // Confirmation in another tab should continue this tab too. Do not await
    // Supabase work inside its auth event callback (the auth lock is held there).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && !inFlight.current) {
        timer = setTimeout(() => { void finish().catch(error => setError(authErrorMessage(error))); }, 0);
      }
    });
    return () => { clearTimeout(timer); data.subscription.unsubscribe(); };
    // The completion callback is kept current in a ref.
  }, [step, service]);

  function changeStep(value: Step) { if (inFlight.current) return; setStep(value); setError(""); setNotice(""); setCode(""); setPassword(""); setConfirmPassword(""); }
  async function run(label: string, action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(label); setError(""); setNotice("");
    try { await action(); }
    catch (error) {
      if ((error as { code?: string })?.code === "email_not_confirmed") {
        setStep("verify"); setPassword(""); setConfirmPassword("");
        setNotice("Confirm your email before signing in. Use your latest confirmation email or request a new one below.");
      } else setError(authErrorMessage(error));
    } finally { inFlight.current = false; setBusy(null); }
  }
  async function submit() {
    if (step === "signup" && (!firstName.trim() || !lastName.trim())) { setError("First and last name are required."); return; }
    if (step === "signup" && password !== confirmPassword) { setError("Passwords do not match."); return; }
    await run(step === "verify" ? "Verifying email" : step === "forgot" ? "Sending reset email" : step === "signup" ? "Creating your account" : "Signing in", async () => {
      if (step === "login") { await service.signIn(email, password); await finish(); }
      if (step === "signup") {
        const result = await service.signUp({ email, password, firstName, lastName, next });
        setPassword(""); setConfirmPassword("");
        if (result.status === "authenticated") await finish();
        else { setStep("verify"); cooldown(); }
      }
      if (step === "verify") { await service.verifyEmail(email, code); await finish(); }
      if (step === "forgot") { await service.resetPassword(email); setStep("reset-sent"); cooldown(); }
    });
  }
  const title = { login: "Welcome back", signup: "Create your account", verify: "Check your email", forgot: "Reset your password", "reset-sent": "Check your inbox" }[step];
  return <section className="account-auth" aria-label="Account access">
    {(step === "login" || step === "signup") && <div className="account-auth__tabs" aria-label="Authentication mode">
      <button type="button" aria-pressed={step === "login"} disabled={!!busy} onClick={() => changeStep("login")}>Sign in</button>
      <button type="button" aria-pressed={step === "signup"} disabled={!!busy} onClick={() => changeStep("signup")}>Create account</button>
    </div>}
    <header className="account-auth__heading">
      {(step === "verify" || step === "reset-sent") && <span className="account-auth__mail" aria-hidden="true"><Mail size={23} /></span>}
      <h1 ref={titleRef} tabIndex={-1}>{title}</h1>
      <p>{step === "login" ? "Sign in to your Clubhouse." : step === "signup" ? "Your team. Your progress. One place." : step === "verify" ? <>Enter the six-digit code sent to <strong>{email.trim()}</strong>.</> : step === "forgot" ? "We’ll email you a secure link to choose a new password." : <>If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way.</>}</p>
    </header>
    {error && <p className="account-auth__error" role="alert">{error}</p>}
    {notice && <p className="account-auth__notice" role="status">{notice}</p>}
    {step !== "reset-sent" && <form onSubmit={event => { event.preventDefault(); void submit(); }} aria-busy={!!busy}>
      <fieldset disabled={!!busy}>
        {step === "signup" && <div className="account-auth__names">
          <label>First name<input autoComplete="given-name" required value={firstName} onChange={event => setFirstName(event.target.value)} /></label>
          <label>Last name<input autoComplete="family-name" required value={lastName} onChange={event => setLastName(event.target.value)} /></label>
        </div>}
        {step !== "verify" && <label>Email<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required readOnly={lockedEmail} value={email} onChange={event => setEmail(event.target.value)} /></label>}
        {(step === "login" || step === "signup") && <label>Password<input type="password" autoComplete={step === "login" ? "current-password" : "new-password"} minLength={step === "signup" ? 8 : undefined} required value={password} onChange={event => setPassword(event.target.value)} />{step === "signup" && <small>At least 8 characters.</small>}</label>}
        {step === "signup" && <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>}
        {step === "verify" && <div className="account-auth__verification">
          <label htmlFor="clubhouse-email-code">Verification code</label>
          <OTPInput id="clubhouse-email-code" aria-label="Six-digit email verification code" aria-describedby="clubhouse-code-hint" aria-invalid={!!error} autoComplete="one-time-code" inputMode="numeric" maxLength={EMAIL_CODE_LENGTH} minLength={EMAIL_CODE_LENGTH} pattern={REGEXP_ONLY_DIGITS} required value={code} onChange={setCode} disabled={!!busy} pasteTransformer={text => text.replace(/\D/g, "")} pushPasswordManagerStrategy="none" containerClassName="account-otp" render={({ slots }) => <>{slots.map((slot, index) => <span key={index} className={`account-otp__slot${slot.isActive ? " is-active" : ""}`} aria-hidden="true">{slot.char}{slot.hasFakeCaret && <span className="account-otp__caret" />}</span>)}</>} />
          <small id="clubhouse-code-hint">Use the most recent email. If it contains a confirmation link instead, you can open that link to continue.</small>
        </div>}
        <button type="submit" className="primary-button account-auth__submit" disabled={!!busy || (step === "verify" && code.length !== EMAIL_CODE_LENGTH)}>{busy ? <><BusyIndicator />{busy}…</> : step === "verify" ? "Verify email" : step === "forgot" ? "Send reset link" : step === "signup" ? "Create account" : "Sign in"}</button>
      </fieldset>
    </form>}
    {step === "login" && <button className="auth-link-button" type="button" disabled={!!busy} onClick={() => changeStep("forgot")}>Forgot password?</button>}
    {step === "verify" && <>
      <button className="auth-link-button" type="button" disabled={!!busy || remaining > 0} onClick={() => void run("Sending a new code", async () => { cooldown(); await service.resendVerification(email, next); setCode(""); setNotice("A new confirmation email has been sent. Check your inbox and spam folder."); })}>{busy === "Sending a new code" ? <><BusyIndicator /> Sending…</> : remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}</button>
      <button className="auth-link-button" type="button" disabled={!!busy} onClick={() => changeStep("login")}><ArrowLeft size={15} aria-hidden="true" />{lockedEmail ? "Back to sign in" : "Use a different email"}</button>
    </>}
    {step === "reset-sent" && <p className="account-auth__notice"><Check size={16} aria-hidden="true" />Open the link in your email to finish resetting your password.</p>}
    {(step === "forgot" || step === "reset-sent") && <button className="auth-link-button" type="button" disabled={!!busy} onClick={() => changeStep("login")}><ArrowLeft size={15} aria-hidden="true" />Back to sign in</button>}
  </section>;
}
