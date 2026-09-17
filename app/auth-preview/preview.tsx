"use client";
import { useState } from "react";
import Image from "next/image";
import { AuthenticationForm } from "../components/AuthenticationForm";
import { AppLoading } from "../components/AppLoading";
import { BRAND_ASSETS } from "../lib/branding";
import type { EmailAuthService } from "../lib/emailAuth";

const delay = () => new Promise<void>(resolve => setTimeout(resolve, 1200));
const service: EmailAuthService = {
  async signIn() { await delay(); },
  async signUp() { await delay(); return { status: "verification-required" }; },
  async verifyEmail(_email, code) { await delay(); if (code !== "123456") throw Object.assign(new Error("Invalid sample code"), { code: "otp_expired" }); },
  async resendVerification() { await delay(); },
  async resetPassword() { await delay(); },
  async updatePassword() { await delay(); },
};
export default function Preview() {
  const [sample, setSample] = useState<"login" | "signup" | "verify" | "loading" | "done">("login");
  return <div className="auth-preview">
    <nav className="auth-preview__toolbar" aria-label="Interface preview">
      <span>Preview<small>No emails sent</small></span>
      <div>{(["login", "signup", "verify", "loading"] as const).map(value => <button key={value} type="button" aria-pressed={sample === value} onClick={() => setSample(value)}>{value}</button>)}</div>
    </nav>
    {sample === "loading" ? <AppLoading label="Loading your team" onRetry={() => setSample("login")} /> : <main className="account-screen">
      <Image className="account-screen__brand brand-wordmark--product" src={BRAND_ASSETS.wordmark} alt="Clubhouse 9" width={190} height={64} unoptimized />
      {sample === "done" ? <section className="account-auth"><h1>Preview complete</h1><p>The verified account would now open Clubhouse.</p><button className="primary-button" onClick={() => setSample("login")}>Start again</button></section> : <AuthenticationForm key={sample} initialStep={sample} initialEmail={sample === "verify" ? "player@example.com" : ""} service={service} onSignedIn={() => setSample("done")} />}
    </main>}
  </div>;
}
