import React from "react";
import { AlertTriangle, TrendingUp, Sparkles, VolumeX, Flame } from "lucide-react";
import { translations } from "../translations";
import { Regime } from "../types";

interface MarketStateSectionProps {
  regime: Regime;
  assessmentEn: string;
  assessmentAr: string;
  language: "en" | "ar";
}

export default function MarketStateSection({ regime, assessmentEn, assessmentAr, language }: MarketStateSectionProps) {
  const t = translations[language];

  // Pick corresponding UI style variations depending on active regime
  const themeDetails = {
    trending: {
      color: "from-emerald-900/40 to-teal-900/40 border-emerald-500/20 text-emerald-400 bg-emerald-500/10",
      pillBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/20",
      icon: <TrendingUp className="w-8 h-8 text-emerald-400" />,
      title: t.regimes.trending,
    },
    ranging: {
      color: "from-indigo-950/40 to-slate-900/40 border-indigo-500/20 text-indigo-400 bg-indigo-500/10",
      pillBg: "bg-indigo-500/20 text-indigo-300 border-indigo-505/20",
      icon: <Sparkles className="w-8 h-8 text-indigo-400" />,
      title: t.regimes.ranging,
    },
    volatile: {
      color: "from-red-950/40 to-orange-950/40 border-red-500/20 text-red-400 bg-red-500/10",
      pillBg: "bg-red-500/20 text-red-300 border-red-500/20",
      icon: <Flame className="w-8 h-8 text-red-400 animate-bounce" />,
      title: t.regimes.volatile,
    },
    quiet: {
      color: "from-slate-950 to-slate-900 border-slate-700 text-slate-400 bg-slate-800/10",
      pillBg: "bg-slate-700/30 text-slate-300 border-slate-700/20",
      icon: <VolumeX className="w-8 h-8 text-slate-400" />,
      title: t.regimes.quiet,
    },
  }[regime || "ranging"];

  const isAr = language === "ar";

  return (
    <div className={`bg-gradient-to-br ${themeDetails.color} border rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-56`}>
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-28 h-28 bg-current opacity-5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Top row with status badge & action identifier */}
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            {t.marketState}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-3 py-1 text-xs font-bold rounded-full border tracking-wide uppercase ${themeDetails.pillBg}`}>
              {themeDetails.title}
            </span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-black/25 border border-white/5 shadow-inner">
          {themeDetails.icon}
        </div>
      </div>

      {/* Detailed qualitative review copy */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-sm text-slate-200 leading-relaxed font-sans">
          {isAr ? assessmentAr : assessmentEn}
        </p>

        {regime === "volatile" && (
          <div className="mt-3.5 flex items-center gap-2 text-rose-300 text-xs font-medium bg-red-500/10 border border-red-500/25 p-2.5 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              {isAr
                ? "تحذير: مؤشر التقلب مرتفع للغاية. قم بتفعيل حدود التحوط الإضافية بالمنصة."
                : "Active Alert: Extreme volatility index triggered. Enhanced hedge modes and tight trailing SL requested."}
            </span>
          </div>
        )}
      </div>

      {/* Grid footer watermark stats */}
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-slate-500">
        <span>FEED: Deterministic Pro</span>
        <span>LATENCY: 0.04ms</span>
      </div>
    </div>
  );
}
