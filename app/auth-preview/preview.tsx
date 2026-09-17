"use client";
import { useState } from "react";
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
  return <>
    <div style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}><span>Interface preview · no emails sent</span>{(["login", "signup", "verify", "loading"] as const).map(value => <button key={value} className="secondary-button" onClick={() => setSample(value)}>{value}</button>)}</div>
    {sample === "loading" ? <AppLoading label="Loading your team" onRetry={() => setSample("login")} /> : <main className="account-screen" style={{ minHeight: "calc(100svh - 100px)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="account-screen__brand brand-wordmark--product" src={BRAND_ASSETS.wordmark} alt="Clubhouse 9" />
      {sample === "done" ? <section className="account-auth"><h1>Preview complete</h1><p>The verified account would now open Clubhouse.</p><button className="primary-button" onClick={() => setSample("login")}>Start again</button></section> : <AuthenticationForm key={sample} initialStep={sample} initialEmail={sample === "verify" ? "player@example.com" : ""} service={service} onSignedIn={() => setSample("done")} />}
    </main>}
  </>;
}
