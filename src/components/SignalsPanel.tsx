import React from "react";
import { TrendingUp, TrendingDown, Target, AlertCircle, ShieldAlert, Sparkles, ChevronRight } from "lucide-react";
import { translations } from "../translations";
import { Signal, Trend } from "../types";

interface SignalsPanelProps {
  signals: Signal[];
  noTradeMessageEn: string | null;
  noTradeMessageAr: string | null;
  language: "en" | "ar";
}

export default function SignalsPanel({ signals, noTradeMessageEn, noTradeMessageAr, language }: SignalsPanelProps) {
  const t = translations[language];
  const isAr = language === "ar";

  const getConfidenceBadge = (conf: string, score?: number) => {
    const scoreVal = score || (conf === "very_high" ? 95 : conf === "high" ? 85 : conf === "medium" ? 70 : 50);
    const textToShow = isAr ? `🎯 الدقة الفنية: ${scoreVal}%` : `🎯 Accuracy Rate: ${scoreVal}%`;
    const colorClass = scoreVal >= 90 
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]" 
      : scoreVal >= 80 
        ? "bg-teal-500/20 text-teal-300 border-teal-500/30" 
        : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";

    return (
      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${colorClass}`}>
        {textToShow}
      </span>
    );
  };

  const formatPrice = (p: number) => {
    return p >= 100 ? p.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(4) : p.toFixed(5);
  };

  return (
    <div className="bg-slate-950/85 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:border-indigo-500/35">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <span>{t.signals}</span>
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md">
          {signals.length} {isAr ? "فرص مفعلة" : "ACTIVE"}
        </span>
      </div>

      {signals.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {signals.map((s, idx) => {
            const isBuy = s.dirEn === "BUY";
            const borderGlow = isBuy
              ? "border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40"
              : "border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40";

            return (
              <div
                key={s.pair}
                className={`border rounded-2xl p-5 shadow-xl transition-all duration-300 ${borderGlow} relative`}
              >
                {/* Header Info */}
                <div className="flex justify-between items-start gap-3 border-b border-white/5 pb-3 mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-widest font-mono">
                      {t.signalCard.pair}
                    </span>
                    <h4 className="text-xl font-extrabold text-white tracking-tight mt-0.5">{s.pair}</h4>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-black tracking-widest uppercase flex items-center gap-1 shadow-md ${
                        isBuy
                          ? "bg-emerald-500 text-slate-950 shadow-emerald-500/10"
                          : "bg-rose-500 text-slate-950 shadow-rose-500/10"
                      }`}
                    >
                      {isBuy ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5 fill-current" />
                          <span>{isAr ? "شراء" : "BUY"}</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3.5 h-3.5 fill-current" />
                          <span>{isAr ? "بيع" : "SELL"}</span>
                        </>
                      )}
                    </span>
                    {getConfidenceBadge(s.confidence, s.score)}
                  </div>
                </div>

                {/* Grid values blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Left Column: Ranges */}
                  <div className="space-y-3 bg-black/20 p-3 rounded-xl border border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        {t.signalCard.entryRange}
                      </span>
                      <span className="text-sm font-semibold text-slate-100 font-mono mt-0.5 block">
                        {formatPrice(s.entry_low)} – {formatPrice(s.entry_high)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-rose-300 uppercase font-bold tracking-wider block flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{t.signalCard.stopLoss}</span>
                      </span>
                      <span className="text-sm font-bold text-rose-400 font-mono mt-0.5 block">
                        {formatPrice(s.stop_loss)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Key Targets */}
                  <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.signalCard.targets}</span>
                    </span>

                    <div className="space-y-1.5 font-mono text-slate-100">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-400 font-bold">TP 1 (Core)</span>
                        <span className="text-emerald-400 font-semibold">{formatPrice(s.target1)}</span>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold">TP 2 (Runner)</span>
                        <span className="text-teal-400 font-semibold">{formatPrice(s.target2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-1">
                        <span className="text-[10px] text-slate-400 font-bold">TP 3 (Extreme)</span>
                        <span className="text-indigo-300 font-semibold">{formatPrice(s.target3)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Setup Quality Stats */}
                <div className="grid grid-cols-3 gap-2 mt-3.5 text-center text-[10px] font-mono py-2 px-3 bg-black/40 rounded-xl border border-white/5">
                  <div>
                    <span className="text-slate-500 uppercase font-bold text-[8px] block">{t.signalCard.rr}</span>
                    <span className="text-indigo-400 font-bold mt-0.5 block">{s.rr}</span>
                  </div>
                  <div className="border-l border-white/5">
                    <span className="text-slate-500 uppercase font-bold text-[8px] block">{t.signalCard.type}</span>
                    <span className="text-teal-400 font-bold mt-0.5 block capitalize">{s.trade_type}</span>
                  </div>
                  <div className="border-l border-white/5">
                    <span className="text-slate-500 uppercase font-bold text-[8px] block">{t.signalCard.risk}</span>
                    <span className={`font-bold mt-0.5 block uppercase ${s.risk_level === "high" ? "text-rose-400 animate-pulse" : "text-slate-300"}`}>{s.risk_level}</span>
                  </div>
                </div>

                {/* Duration & Execution timing metadata */}
                <div className="mt-3.5 space-y-2.5 bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 text-xs leading-normal">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">{isAr ? "⏱️ المدة المتوقعة" : "⏰ ESTIMATED DURATION"}</span>
                    <span className="text-purple-300 font-bold">{isAr ? s.estimatedDurationAr : s.estimatedDurationEn}</span>
                  </div>
                  <div className="border-t border-white/5 pt-2">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">{isAr ? "🔐 تكتيك الخروج وتأمين الأرباح" : "🔐 EXIT STRATEGY & RISK MANAGEMENT"}</span>
                    <p className="text-[11px] text-slate-300 font-sans">
                      {isAr ? s.exitStrategyAr : s.exitStrategyEn}
                    </p>
                  </div>
                </div>

                {/* Advanced Quantitative Intelligence Layer */}
                <div className="mt-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl p-3 text-[11px] space-y-3">
                  <div className="flex items-center justify-between border-b border-indigo-500/10 pb-1.5">
                    <span className="text-indigo-400 font-black uppercase tracking-wider text-[8px]">
                      {isAr ? "🔬 بنية ميكروية وتوافق فيبوناتشي" : "🔬 MICROSTRUCTURE & CONVERGENCES"}
                    </span>
                    <span className="text-indigo-300 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded text-[8px]">
                      {isAr ? "تصنيف معايرة تكييفية" : "ADAPTIVE CALIBRATION"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Microstructure Panel */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">
                        {isAr ? "دفاتر الطلبات (Imbalance)" : "ORDER BOOK PRESSURE"}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-slate-200">
                          {s.orderBookImbalance !== undefined && s.orderBookImbalance >= 0 
                            ? `+${(s.orderBookImbalance * 100).toFixed(0)}% ${isAr ? "ضغط شراء" : "Bid Pressure"}`
                            : `${((s.orderBookImbalance || 0) * 100).toFixed(0)}% ${isAr ? "ضغط بيع" : "Ask Pressure"}`}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {isAr ? "كثافة سيولة: " : "Volume Int: "}{(s.volumeClusterIntensity || 50)}%
                        </span>
                      </div>
                      {/* Visual gauge */}
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${s.orderBookImbalance !== undefined && s.orderBookImbalance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.round(50 + ((s.orderBookImbalance || 0) * 50))}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Fibonacci Levels matrix */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">
                        {isAr ? "مستويات فيبوناتشي" : "FIBONACCI LEVELS (GOLDEN ZONE)"}
                      </span>
                      {s.fibLevels ? (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[9px] text-slate-350">
                          <div className="flex justify-between">
                            <span>61.8%</span>
                            <span className="text-slate-200 font-semibold">{formatPrice(s.fibLevels.fib618)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>50.0%</span>
                            <span className="text-slate-200 font-semibold">{formatPrice(s.fibLevels.fib500)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>78.6%</span>
                            <span className="text-slate-350 font-semibold">{formatPrice(s.fibLevels.fib786)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>38.2%</span>
                            <span className="text-slate-350 font-semibold">{formatPrice(s.fibLevels.fib382)}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-500 italic block">{isAr ? "قيد الحساب التلقائي..." : "Recalibrating..."}</span>
                      )}
                    </div>
                  </div>

                  {/* Ensemble Votes */}
                  {s.ensembleVotes && s.ensembleVotes.length > 0 && (
                    <div className="border-t border-indigo-500/10 pt-2 flex flex-wrap gap-1 items-center">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mr-1">
                        {isAr ? "الأصوات التوافقية:" : "ENSEMBLE CONSENSUS:"}
                      </span>
                      {s.ensembleVotes.map((vote, vIdx) => (
                        <span key={vIdx} className="px-1.5 py-0.5 rounded bg-indigo-500/5 text-slate-300 border border-indigo-500/10 font-mono text-[8px] tracking-tight">
                          {vote}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detailed analysis notes */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 block tracking-widest uppercase">
                    {t.signalCard.rationale}
                  </span>
                  <p className="text-xs text-slate-350 mt-1 leading-relaxed leading-[1.6]">
                    {isAr ? s.reasonAr || s.reason : s.reason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty / No Signal Teaser Panel */
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center text-slate-400 flex flex-col items-center justify-center">
          <AlertCircle className="w-10 h-10 text-amber-500/40 mb-3 animate-[pulse_3.s_infinite]" />
          <h4 className="text-sm font-semibold text-slate-200 mb-1">
            {isAr ? "لم يتم تأكيد أي إشارات تداول مفعلة" : "No Active Trading Opportunities Found"}
          </h4>
          <p className="text-xs max-w-md mx-auto leading-relaxed text-slate-500">
            {isAr ? noTradeMessageAr : noTradeMessageEn}
          </p>
        </div>
      )}
    </div>
  );
}
