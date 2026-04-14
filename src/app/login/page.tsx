"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Eye, EyeOff, Shield } from "lucide-react";

const DEV_CODE = "123456";
const isProd = process.env.NEXT_PUBLIC_APP_ENV === "production";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [remember, setRemember] = useState<"3" | "6" | "12">("6");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const newCode = isProd ? "" : DEV_CODE;
    setGeneratedCode(newCode);
    setTimeout(() => {
      setLoading(false);
      setStep("code");
    }, 800);
  }

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      localStorage.setItem("travelwifi_ops_user_email", email);
      router.push("/dashboard");
    }, 800);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: Hero Gradient */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-mysteria via-[#2a2558] to-mysteria relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-lavender/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-amethyst/20 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 backdrop-blur-sm border border-white/20">
              <span className="text-lg font-bold text-white">T</span>
            </div>
            <span className="text-[20px] font-[600] text-white/95">TravelWifi Ops</span>
          </div>
          <h1 className="text-[48px] text-display text-white/95 mb-4">
            Support,<br />elevated.
          </h1>
          <p className="text-[16px] font-[460] leading-[1.5] text-white/70">
            The internal operations hub for customer support agents. Fast, unified, and built for 24/7 teams across time zones.
          </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-mysteria">
              <span className="text-sm font-bold text-white">T</span>
            </div>
            <span className="text-[18px] font-[600] text-foreground">TravelWifi Ops</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] text-feature text-foreground">
              {step === "email" ? "Sign in" : "Verify identity"}
            </h2>
            <p className="mt-2 text-[14px] font-[460] leading-[1.5] text-muted-foreground">
              {step === "email"
                ? "Enter your work email to continue."
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Dev/Staging: show the 2FA code on screen */}
          {step === "code" && !isProd && generatedCode && (
            <div className="mb-4 rounded-[8px] border border-lavender bg-lavender/10 px-4 py-3">
              <p className="text-[12px] font-[600] text-amethyst uppercase tracking-wider mb-1">
                Dev Mode — 2FA Code
              </p>
              <p className="text-[28px] font-[700] text-foreground tracking-[0.3em] font-mono">
                {generatedCode}
              </p>
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-[600] text-foreground mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@travelwifi.com"
                    required
                    className="w-full rounded-[8px] border border-border bg-background py-2.5 pl-10 pr-4 text-[14px] font-[460] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors duration-150 focus:border-lavender focus:ring-1 focus:ring-lavender"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[8px] bg-cream py-2.5 text-[16px] font-[700] text-charcoal transition-colors duration-150 hover:bg-cream-hover disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-[600] text-foreground mb-1.5">
                  Verification code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                  <input
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="w-full rounded-[8px] border border-border bg-background py-2.5 pl-10 pr-10 text-[14px] font-[460] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors duration-150 focus:border-lavender focus:ring-1 focus:ring-lavender tracking-[0.3em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showCode ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Device */}
              <div>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <Shield className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                  <span className="text-[13px] font-[600] text-foreground">
                    Remember this device
                  </span>
                </label>
                <div className="flex gap-2">
                  {(["3", "6", "12"] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setRemember(h)}
                      className={`flex-1 rounded-[8px] border py-1.5 text-[13px] font-[500] transition-colors duration-150 cursor-pointer ${
                        remember === h
                          ? "border-lavender bg-lavender/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[8px] bg-cream py-2.5 text-[16px] font-[700] text-charcoal transition-colors duration-150 hover:bg-cream-hover disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full text-center text-[13px] font-[460] text-amethyst hover:underline cursor-pointer"
              >
                Use a different email
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-[12px] font-[460] text-muted-foreground/60">
            Secured with Mailgun 2FA
          </p>
        </div>
      </div>
    </div>
  );
}
