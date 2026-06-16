"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Smartphone,
  Loader2,
  Zap,
  Lightbulb,
  Battery,
  Wifi,
  Settings,
  HelpCircle,
  Shield,
  Phone,
  Wrench,
  Package,
  Globe,
  X,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KbSubsection {
  title: string;
  content: string;
}

interface KbSection {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  subsections: KbSubsection[];
}

interface KbData {
  model: string;
  productName: string;
  sections: KbSection[];
  images: string[];
}

interface KbSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelCode: string;
  deviceLabel: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amethyst/20 text-foreground rounded-[4px] px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function scoreMatch(section: KbSection, terms: string[]): number {
  let score = 0;
  const titleLower = section.title.toLowerCase();
  const contentLower = section.content.toLowerCase();
  const subText = section.subsections.map((s) => s.title + " " + s.content).join(" ").toLowerCase();

  for (const term of terms) {
    if (titleLower.includes(term)) score += 10;
    if (section.keywords.some((k) => k.includes(term))) score += 5;
    if (contentLower.includes(term)) score += 2;
    if (subText.includes(term)) score += 1;
  }
  return score;
}

function formatInline(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}

function replaceProductName(text: string, deviceLabel: string): string {
  return text.replace(/\bTeppy TravelWiFi\b/gi, deviceLabel).replace(/\bTeppy\b/gi, deviceLabel);
}

function renderContent(content: string, query: string, deviceLabel: string): React.ReactNode {
  const lines = content.split("\n").filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^[-*]\s*(how|what|where|why|when|does|is|can|my|check|see|use|turn|change|reset|lost|no |wifi|battery|signal|charging|activate|connect)/i.test(t)) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const replaced = replaceProductName(formatInline(trimmed), deviceLabel);

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const bullet = replaced.replace(/^[-*]\s*/, "");
          return (
            <div key={i} className="flex gap-2.5 text-[13px] font-[460] text-foreground/90">
              <span className="text-amethyst/40 shrink-0 mt-0.5">-</span>
              <span>{highlightMatch(bullet, query)}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const [num, ...rest] = replaced.split(/\.\s/);
          return (
            <div key={i} className="flex gap-2.5 text-[13px] font-[460] text-foreground/90">
              <span className="text-amethyst/60 font-[600] shrink-0 w-5 text-right">{num}.</span>
              <span>{highlightMatch(rest.join(". "), query)}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-[13px] font-[460] text-foreground/90 leading-relaxed">
            {highlightMatch(replaced, query)}
          </p>
        );
      })}
    </div>
  );
}

type IconComponent = typeof BookOpen;
const CATEGORY_ICONS: [RegExp, IconComponent][] = [
  [/hardware|device.*overview/i, Smartphone],
  [/how to use|getting started/i, Play],
  [/power|core.*action/i, Zap],
  [/led|indicator|light/i, Lightbulb],
  [/charg|battery/i, Battery],
  [/wifi|wi-fi|password|name/i, Wifi],
  [/sim|cloudsim/i, Globe],
  [/setup|start|activation/i, Settings],
  [/management|admin|web|192/i, Wrench],
  [/lost|stolen/i, Shield],
  [/troubleshoot|problem|decision/i, Search],
  [/faq|question|q&a/i, HelpCircle],
  [/technical|spec/i, Package],
  [/contact|support/i, Phone],
  [/glossary/i, BookOpen],
  [/connection|timing/i, Globe],
  [/usage|data.*sav/i, Wrench],
];

function getCategoryIcon(title: string): IconComponent {
  for (const [pattern, icon] of CATEGORY_ICONS) {
    if (pattern.test(title)) return icon;
  }
  return BookOpen;
}

const IMAGE_LABELS = ["Back / SIM slot", "Front / LEDs / Buttons"];

function ImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      <p className="text-[11px] font-[600] uppercase tracking-wider text-amethyst/70 mb-2 px-1">
        Device Reference
      </p>
      <div className="flex-1 min-h-0 rounded-[8px] border border-lavender/30 bg-white overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[idx]}
          alt={IMAGE_LABELS[idx] || "Device diagram"}
          className="max-w-full max-h-full object-contain p-2"
        />
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <button
            onClick={() => setIdx((prev) => (prev - 1 + images.length) % images.length)}
            className="h-7 w-7 rounded-[8px] flex items-center justify-center border border-lavender/30 text-muted-foreground hover:bg-lavender/10 hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <span className="text-[11px] font-[540] text-muted-foreground">
            {IMAGE_LABELS[idx] || `${idx + 1} / ${images.length}`}
          </span>
          <button
            onClick={() => setIdx((prev) => (prev + 1) % images.length)}
            className="h-7 w-7 rounded-[8px] flex items-center justify-center border border-lavender/30 text-muted-foreground hover:bg-lavender/10 hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

export function KbSlideOver({ open, onOpenChange, modelCode, deviceLabel }: KbSlideOverProps) {
  const [kb, setKb] = useState<KbData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<KbSection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !modelCode) return;
    if (kb?.model === modelCode) return;

    setLoading(true);
    setError(null);
    fetch(`/api/kb/${encodeURIComponent(modelCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setKb(data.data);
        else setError(data.error || "KB not found");
      })
      .catch(() => setError("Failed to load KB"))
      .finally(() => setLoading(false));
  }, [open, modelCode, kb?.model]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveSection(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const filteredSections = useMemo(() => {
    if (!kb) return [];
    if (!query.trim()) return kb.sections;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return kb.sections
      .map((s) => ({ section: s, score: scoreMatch(s, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.section);
  }, [kb, query]);

  function openSection(section: KbSection) {
    setActiveSection(section);
    contentRef.current?.scrollTo(0, 0);
  }

  function goBack() {
    setActiveSection(null);
  }

  const hasImages = kb && kb.images.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[1100px] w-[95vw] max-h-[85vh] p-0 overflow-hidden rounded-[16px] flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-lavender/20 shrink-0">
          <div className="h-8 w-8 rounded-[8px] bg-amethyst/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-[15px] font-[600] text-foreground">
              Device Knowledge Base
            </DialogTitle>
            <DialogDescription className="text-[12px] font-[460] text-muted-foreground">
              {deviceLabel}
            </DialogDescription>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:bg-lavender/10 hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-lavender/10 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.8} />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveSection(null); }}
              placeholder="Search troubleshooting, LED meanings, charging, reset..."
              className="pl-9 h-9 rounded-[8px] border-lavender/30 bg-lavender/5 text-[13px] font-[460] placeholder:text-muted-foreground/50 focus-visible:ring-amethyst/30"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setActiveSection(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Body: content left + images right */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel: content */}
          <div className="flex-1 flex flex-col min-h-0">
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-amethyst/50" />
                <span className="ml-2 text-[13px] font-[460] text-muted-foreground">Loading KB...</span>
              </div>
            )}

            {error && (
              <div className="flex-1 p-5">
                <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-[13px] font-[460] text-red-700">
                  {error}
                </div>
              </div>
            )}

            {!loading && !error && kb && !activeSection && (
              <div className="flex-1 overflow-y-auto p-4" ref={contentRef}>
                {/* Quick filters */}
                {!query && (
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    {["Troubleshooting", "LED", "How to use", "FAQ", "SIM", "Charging", "Reset", "Lost"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setQuery(tag.toLowerCase())}
                        className="text-[11px] font-[540] rounded-[8px] border border-lavender/30 bg-background px-2.5 py-1 text-muted-foreground hover:bg-lavender/10 hover:text-foreground transition-colors cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results */}
                {query.trim() && filteredSections.length === 0 && (
                  <div className="text-center py-16">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.4} />
                    <p className="text-[13px] font-[460] text-muted-foreground">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-[12px] font-[460] text-muted-foreground/70 mt-1">
                      Try: LED, charging, reset, SIM, WiFi
                    </p>
                  </div>
                )}

                {/* Section cards */}
                <div className="grid grid-cols-2 gap-2">
                  {filteredSections.map((section) => {
                    const Icon = getCategoryIcon(section.title);
                    const subCount = section.subsections.length;
                    const preview = replaceProductName(
                      section.content.split("\n").find((l) => l.trim().length > 10) || "",
                      deviceLabel,
                    ).slice(0, 80);

                    return (
                      <button
                        key={section.id}
                        onClick={() => openSection(section)}
                        className="flex items-start gap-3 rounded-[8px] border border-lavender/20 bg-background p-3 text-left hover:bg-lavender/5 hover:border-amethyst/20 transition-colors cursor-pointer group"
                      >
                        <div className="h-8 w-8 rounded-[8px] bg-lavender/10 flex items-center justify-center shrink-0 group-hover:bg-amethyst/10 transition-colors">
                          <Icon className="h-4 w-4 text-amethyst/60 group-hover:text-amethyst" strokeWidth={1.6} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-[540] text-foreground truncate">
                            {highlightMatch(replaceProductName(section.title, deviceLabel), query)}
                          </p>
                          {preview && (
                            <p className="text-[11px] font-[460] text-muted-foreground/70 mt-0.5 line-clamp-2">
                              {highlightMatch(preview, query)}
                            </p>
                          )}
                          {subCount > 0 && (
                            <p className="text-[10px] font-[540] text-amethyst/50 mt-1">
                              {subCount} {subCount === 1 ? "topic" : "topics"}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-amethyst/60" strokeWidth={1.8} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!loading && !error && kb && activeSection && (
              <div className="flex-1 overflow-y-auto" ref={contentRef}>
                {/* Back bar */}
                <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm border-b border-lavender/10 px-5 py-2.5 flex items-center gap-2">
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1.5 text-[12px] font-[540] text-amethyst hover:text-amethyst/80 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    Back
                  </button>
                  <span className="text-muted-foreground/30 text-[12px]">/</span>
                  <span className="text-[12px] font-[540] text-foreground truncate">
                    {replaceProductName(activeSection.title, deviceLabel)}
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  <div className="flex items-start gap-3">
                    {(() => {
                      const Icon = getCategoryIcon(activeSection.title);
                      return (
                        <div className="h-10 w-10 rounded-[8px] bg-amethyst/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-amethyst" strokeWidth={1.6} />
                        </div>
                      );
                    })()}
                    <div>
                      <h2 className="text-[17px] font-[600] text-foreground">
                        {replaceProductName(activeSection.title, deviceLabel)}
                      </h2>
                      {activeSection.subsections.length > 0 && (
                        <p className="text-[12px] font-[460] text-muted-foreground mt-0.5">
                          {activeSection.subsections.length} topics
                        </p>
                      )}
                    </div>
                  </div>

                  {activeSection.content && (
                    <div className="rounded-[8px] border border-lavender/20 bg-lavender/5 p-4">
                      {renderContent(activeSection.content, query, deviceLabel)}
                    </div>
                  )}

                  {activeSection.subsections.map((sub, i) => (
                    <div key={i} className="rounded-[8px] border border-lavender/15 bg-background p-4">
                      <h3 className="text-[14px] font-[600] text-foreground mb-2.5">
                        {highlightMatch(replaceProductName(sub.title, deviceLabel), query)}
                      </h3>
                      {renderContent(sub.content, query, deviceLabel)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && !kb && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Smartphone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.4} />
                  <p className="text-[13px] font-[460] text-muted-foreground">
                    No knowledge base available for this device model
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Left panel: image carousel */}
          {hasImages && (
            <div className="w-[380px] shrink-0 p-4 border-r border-lavender/15 order-first">
              <ImageCarousel images={kb!.images} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
