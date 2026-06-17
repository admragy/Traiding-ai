import React, { useState } from "react";
import { HardHat, ShieldCheck, Scale, Calculator, AlertTriangle, Coins, TrendingUp, HelpCircle } from "lucide-react";
import { Signal, Regime } from "../types";

interface FinancialAdvisorPanelProps {
  signals: Signal[];
  marketRegime: Regime;
  language: "en" | "ar";
}

export default function FinancialAdvisorPanel({ signals, marketRegime, language }: FinancialAdvisorPanelProps) {
  const isAr = language === "ar";

  // Account inputs
  const [capital, setCapital] = useState<number>(10000);
  const [maxRiskPct, setMaxRiskPct] = useState<number>(1); // default 1% risk per trade
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Constants
  const minRisk = 0.25;
  const maxRisk = 5.0;

  // Calculate Kelly Criterion recommendation based on active market regime and signals
  const estimateWinRate = (regime: Regime) => {
    switch (regime) {
      case "trending":
        return 0.68; // 68% win rate in clear trending phases
      case "volatile":
        return 0.45; // 45% in highly volatile environments (requires smaller layouts!)
      case "ranging":
        return 0.55; // 55% in ranging channels
      case "quiet":
      default:
        return 0.52; // 52% in quiet markets
    }
  };

  const winRate = estimateWinRate(marketRegime);
  
  // R:R is roughly 1:3 across the system
  const avgRR = 3.0; 
  // Kelly % = W - [(1-W)/R]
  const kellyPct = Math.max(0, winRate - ((1 - winRate) / avgRR));
  // Conservative Half-Kelly (Standard professional management practice to avoid ruin)
  const halfKelly = kellyPct / 2;

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-indigo-500/40">
      
      {/* Decorative financial background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-3xl pointer-events-none rounded-full"></div>

      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <Scale className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{isAr ? "مستشار إدارة المخاطر وحجم الصفقات" : "Risk Management & Sizing Advisor"}</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
              {isAr ? "بروتوكول حماية وتخصيص السيولة الذكي" : "Duran Capital Allocation & Advisory Protocol"}
            </p>
          </div>
        </div>

        <button 
          onClick={() => setShowExplanation(!showExplanation)}
          className="p-1 px-2.5 rounded-lg border border-slate-800 bg-slate-900/40 text-[10px] font-bold text-slate-400 hover:text-white transition cursor-pointer"
        >
          {isAr ? "كيف تعمل؟" : "How it works"}
        </button>
      </div>

      {/* Educational info block */}
      {showExplanation && (
        <div className="mb-5 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-2">
          {isAr ? (
            <>
              <p>
                💡 يهدف <strong>مستشار المخاطر</strong> إلى حماية محفظتك من الإفلاس وتجنب العشوائية الرقمية في التداول. يعتمد النظام على معادلات هندسة المحافظ الرياضية وعلم إدارة النقد الاحترافي:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li><strong>حجم الصفقات الذكي:</strong> يُحسب لضمان خسارة نسبة ثابتة ومحددة بدقة من رأس مالك (مثلاً 1%) فقط في حال ضرب وقف الخسارة.</li>
                <li><strong>معيار كيلي (Kelly Criterion):</strong> نموذج مستشار رياضي يقيس النسبة المثالية للمخاطرة تبعاً لمعدل نجاح الاستراتيجية ونسبة العائد للمخاطرة (R:R) لتعظيم حجم النمو الهندسي للمحفظة على المدى الطويل.</li>
              </ul>
            </>
          ) : (
            <>
              <p>
                💡 The <strong>Risk Sizer</strong> applies quantitative capital management formulas to prevent ruin and systematically grow portfolios.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li><strong>Dynamic Position Sizing:</strong> Calculates correct asset units or lots to trade ensuring that your total capital draft never exceeds your predefined risk percentage if a Stop-Loss is hit.</li>
                <li><strong>Kelly Criterion:</strong> A mathematical model determining key optimal leverage/allocations depending on system win expectancy and trade payoff structure.</li>
              </ul>
            </>
          )}
        </div>
      )}

      {/* Inputs block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        
        {/* Capital Slider & manual entry */}
        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "رأس المال المخصص (USD)" : "Total Trading Capital (USD)"}</span>
            </label>
            <input 
              type="number" 
              value={capital}
              onChange={(e) => setCapital(Math.max(10, Number(e.target.value)))}
              className="w-24 bg-slate-900 border border-slate-700/60 rounded px-2 py-1 text-xs text-emerald-400 font-bold font-mono text-right focus:outline-none focus:border-indigo-500"
            />
          </div>
          <input 
            type="range" 
            min="100" 
            max="100000" 
            step="100"
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>$100</span>
            <span>$50,000</span>
            <span>$100,000</span>
          </div>
        </div>

        {/* Risk percentage */}
        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? "أقصى مخاطرة لكل صفقة (%)" : "Max Risk Per Trade (%)"}</span>
            </label>
            <span className="text-xs font-black font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              {maxRiskPct.toFixed(2)}%
            </span>
          </div>
          <input 
            type="range" 
            min={minRisk} 
            max={maxRisk} 
            step="0.05"
            value={maxRiskPct}
            onChange={(e) => setMaxRiskPct(Number(e.target.value))}
            className="w-full accent-indigo-500 bg-slate-850 h-1.5 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>0.25% ({isAr ? "محافظ جداً" : "Conservative"})</span>
            <span>2.50%</span>
            <span>5.00% ({isAr ? "عدواني" : "Aggressive"})</span>
          </div>
        </div>

      </div>

      {/* Regimes Financial Advisory commentary strip */}
      <div className="mb-6 p-4 rounded-2xl border border-slate-800 bg-slate-900/20 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">
              {isAr ? "إرشادات المستشار المالي الفورية" : "Immediate Financial Advisory Directive"}
            </h4>
            <p className="text-[10.5px] text-slate-400 leading-normal mt-0.5">
              {isAr ? (
                marketRegime === "volatile" ? (
                  "🚨 تقلبات مكثفة ومستمرة بالسوق! يرجى تخفيض حجم الصفقات إلى 0.5% كحد أقصى لحماية المحفظة، وتفضيل الذهب (XAU/USD) على أصول الكريبتو مؤقتاً."
                ) : marketRegime === "trending" ? (
                  "🟢 الأسواق تسير في اتجاهات واضحة وقوية! الزخم الرياضي متناسق ويبرر رفع حجم المخاطرة إلى 1.5% لكل صفقة مع الالتزام بالهدف الأول لتأمين نقطة الدخول."
                ) : (
                  "⚖️ تذبذب مستقر أو سوق عرضي هادئ. التزم بنسب المخاطرة المعتدلة (1%)، واحرص على نقل وقف الخسارة فور تحقيق الهدف الأول."
                )
              ) : (
                marketRegime === "volatile" ? (
                  "🚨 Intensely volatile market conditions! Reduce position sizes immediately to 0.5% maximum to shield your equity. Prefer Gold over high-volatility crypto slots."
                ) : marketRegime === "trending" ? (
                  "🟢 Highly structured trending regime detected! Momentum equations are aligned. Capital risks of up to 1.5% per position are quantitatively justified."
                ) : (
                  "⚖️ Range-bound, sideways, or quiet market regime. Limit exposure to a disciplined 1% per slot. Always lock/trail stop-loss to entry once target 1 is accomplished."
                )
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Kelly Criterion allocations */}
      <div className="mb-6 bg-black/40 border border-slate-900 p-4 rounded-2xl">
        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-400" />
          <span>{isAr ? "حاسبة معيار كيلي الاستشاري (Optimal Sizing)" : "Kelly Sizing Optimizer (Formula Guidance)"}</span>
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs font-mono">
          <div className="bg-slate-900/30 border border-white/5 p-2 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase font-bold block">{isAr ? "مستوى النجاح المتوقع" : "Expected Win-Rate"}</span>
            <span className="text-sm font-bold text-teal-400 mt-1 block">{(winRate * 100).toFixed(0)}%</span>
            <span className="text-[8px] text-slate-500 block mt-0.5">{isAr ? "مستمد من بيئة السوق" : "Regime Adaptive"}</span>
          </div>
          <div className="bg-slate-900/30 border border-white/5 p-2 rounded-xl">
            <span className="text-[9px] text-slate-500 uppercase font-bold block">{isAr ? "حجم كيلي الكامل" : "Full Kelly Lever"}</span>
            <span className="text-sm font-bold text-indigo-400 mt-1 block">{(kellyPct * 100).toFixed(1)}%</span>
            <span className="text-[8px] text-slate-500 block mt-0.5">{isAr ? "أقصى عائد نظري" : "Maximum Math Expectation"}</span>
          </div>
          <div className="bg-slate-900/30 border border-white/5 p-2 rounded-xl border-dashed border-indigo-500/20 shadow-[inset_0_0_8px_rgba(99,102,241,0.02)]">
            <span className="text-[9px] text-indigo-400/80 uppercase font-black block">{isAr ? "كيلي المحافظ المقترح" : "Optimal Safe Sizing"}</span>
            <span className="text-sm font-black text-emerald-400 mt-1 block">{(halfKelly * 100).toFixed(1)}%</span>
            <span className="text-[8px] text-emerald-500/70 block mt-0.5">{isAr ? "الحد اليومي الآمن كلياً" : "Safe Half-Kelly limit"}</span>
          </div>
        </div>
      </div>

      {/* Position size recommendations for active signals */}
      <div>
        <h4 className="text-xs font-bold text-white mb-3">
          {isAr ? "📐 حاسبة لوتات الصفقات المفتوحة حالياً" : "📐 Position Size Calculator for Active Signals"}
        </h4>

        {signals.length > 0 ? (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {signals.map((s) => {
              // Position sizing formula: Capital to risk in USD / absolute price difference to stop-loss
              const dollar_risk = capital * (maxRiskPct / 100);
              const isBuy = s.dirEn === "BUY";
              
              // Find average entry as midpoint
              const avgEntry = (s.entry_low + s.entry_high) / 2;
              const priceDiff = Math.abs(avgEntry - s.stop_loss);
              
              // Calculated position size of asset units
              const unitSize = priceDiff > 0 ? dollar_risk / priceDiff : 0;
              
              // Estimated Reward calculation at TP1 and TP2
              const rewardTP1 = Math.abs(s.target1 - avgEntry) * unitSize;
              const rewardTP2 = Math.abs(s.target2 - unitSize > 0 ? s.target2 - avgEntry : 0) * unitSize;

              const formatVal = (v: number) => {
                return v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v >= 0.01 ? v.toFixed(2) : v.toFixed(5);
              };

              return (
                <div key={s.pair} className="bg-slate-900/50 border border-slate-850 rounded-xl p-3 text-xs leading-normal space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span>{s.pair}</span>
                      <span className="text-[9px] text-slate-500 font-normal">({isBuy ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')})</span>
                    </span>
                    <span className="font-mono text-slate-400 font-semibold">{s.rr} R:R</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[11px] font-mono leading-none py-1">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">
                        {isAr ? "حجم الصفقة المقترح" : "Suggested Position"}
                      </span>
                      <span className="text-indigo-400 font-extrabold text-xs block">
                        {vIdxFormatted(unitSize, s.pair)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">
                        {isAr ? "الخسارة المحتملة المحددة" : "Calculated Max Loss"}
                      </span>
                      <span className="text-rose-400 font-bold text-xs block">
                        ${dollar_risk.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[10px] font-mono pt-1 text-slate-400 leading-none">
                    <div>
                      <span>{isAr ? "الربح التقريبي (TP 1)" : "Est Profit (TP 1)"}: </span>
                      <span className="text-emerald-500 font-bold">${formatVal(rewardTP1)}</span>
                    </div>
                    <div>
                      <span>{isAr ? "الربح التقريبي (TP 2)" : "Est Profit (TP 2)"}: </span>
                      <span className="text-teal-400 font-bold">${formatVal(rewardTP2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-slate-900 bg-slate-900/20 rounded-2xl text-xs text-slate-500 italic">
            {isAr ? "بانتظار تفعيل إشارات تداول لحساب دقيق لحجم اللوتات والصفقات." : "Waiting for active signals to calculate optimal trade positions."}
          </div>
        )}
      </div>

    </div>
  );
}

// Format units depending on the asset type (e.g. BTC has lots of fractions, gold is ounces, forex is mini lots)
function vIdxFormatted(v: number, symbol: string) {
  if (symbol.includes("BTC")) {
    return `${v.toFixed(4)} BTC (Coins)`;
  }
  if (symbol.includes("ETH")) {
    return `${v.toFixed(3)} ETH`;
  }
  if (symbol.includes("XAU")) {
    return `${v.toFixed(2)} Ounces Gold`;
  }
  if (symbol.includes("EUR") || symbol.includes("GBP") || symbol.includes("JPY")) {
    const lotSize = v / 100000;
    return `${lotSize.toFixed(3)} Standard Lots (${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} units)`;
  }
  return `${v >= 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v.toFixed(4)} Units`;
}
