import React from "react";
import { Coins, Layers, Award, ShieldAlert, Sparkles, TrendingUp, TrendingDown, HelpCircle, Star } from "lucide-react";
import { translations } from "../translations";
import { Asset, Category } from "../types";
import Sparkline from "./Sparkline";

interface UniverseTableProps {
  assets: Asset[];
  selectedCategory: "all" | Category;
  onSelectCategory: (c: "all" | Category) => void;
  language: "en" | "ar";
  focusedSymbols: string[];
  onToggleFocusSymbol: (sym: string) => void;
  focusOnlyMode: boolean;
  onToggleFocusOnlyMode: () => void;
  activeCategories: Exclude<Category, "all">[];
  onToggleActiveCategory: (category: Exclude<Category, "all">) => void;
}

export default function UniverseTable({
  assets,
  selectedCategory,
  onSelectCategory,
  language,
  focusedSymbols,
  onToggleFocusSymbol,
  focusOnlyMode,
  onToggleFocusOnlyMode,
  activeCategories,
  onToggleActiveCategory,
}: UniverseTableProps) {
  const t = translations[language];
  const isAr = language === "ar";

  const categories = [
    { key: "all" as const, label: t.categoryAll },
    { key: "forex" as const, label: t.categoryForex },
    { key: "crypto" as const, label: t.categoryCrypto },
    { key: "gold" as const, label: t.categoryGold },
    { key: "indices" as const, label: t.categoryIndices },
  ];

  const formatPrice = (p: number) => {
    return p >= 100 ? p.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(4) : p.toFixed(5);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 75) return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    if (score > 0) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-slate-500 bg-slate-800/20 border-slate-700/20";
  };

  return (
    <div className="bg-slate-950/85 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:border-slate-700">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none"></div>

      {/* Active Market Sectors Configuration / Engine Run Scope */}
      <div className="mb-6 p-5 rounded-2xl bg-slate-900/20 border border-slate-850 relative z-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-4.5">
          <div className="text-right sm:text-left">
            <h4 className="text-xs font-bold text-slate-200 flex items-center justify-start gap-1.5 font-sans">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? "تخصيص أسواق التحليل المفعّلة" : "Engine Target Scan Sectors"}</span>
            </h4>
            <p className="text-[10.5px] text-slate-400 mt-1 leading-normal font-sans">
              {isAr 
                ? "حدد فئات الأسواق (العملات الرقمية أو الفوركس أو غيرها) التي ترغب بمسحها وإنشاء الإشارات والتحذيرات والطيار الآلي عليها"
                : "Choose which financial markets the engine runs analysis, alerts, and 24/7 Autopilot on."}
            </p>
          </div>
          <div className="text-[9px] font-mono font-bold text-slate-550 uppercase tracking-widest bg-slate-950 border border-slate-800 px-2 py-0.5 rounded shrink-0 self-start md:self-auto">
            {isAr ? "تصفية الفئات الفعالة" : "ACTIVE CAN SCOPE"}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { key: "forex" as const, label: t.categoryForex, icon: Coins, colorActive: "border-blue-500/40 bg-blue-500/11 text-blue-300 ring-1 ring-blue-500/20" },
            { key: "crypto" as const, label: t.categoryCrypto, icon: Sparkles, colorActive: "border-purple-500/40 bg-purple-500/11 text-purple-300 ring-1 ring-purple-500/20" },
            { key: "gold" as const, label: t.categoryGold, icon: Award, colorActive: "border-amber-500/40 bg-amber-500/11 text-amber-300 ring-1 ring-amber-500/20" },
            { key: "indices" as const, label: t.categoryIndices, icon: TrendingUp, colorActive: "border-emerald-500/40 bg-emerald-500/11 text-emerald-300 ring-1 ring-emerald-500/20" },
          ].map((item) => {
            const isActive = activeCategories.includes(item.key);
            const IconComp = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggleActiveCategory(item.key)}
                className={`py-3 px-4 rounded-xl border flex items-center justify-between text-left transition-all duration-200 cursor-pointer ${
                  isActive
                    ? item.colorActive
                    : "border-slate-900 bg-slate-950/40 text-slate-500 hover:border-slate-800 hover:text-slate-300"
                }`}
                dir="ltr"
              >
                <div className="flex items-center gap-2">
                  <IconComp className={`w-4 h-4 ${isActive ? "" : "text-slate-600"}`} />
                  <span className="text-xs font-extrabold">{item.label}</span>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isActive ? "border-current bg-current/15 text-white" : "border-slate-800"}`}>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {focusOnlyMode && focusedSymbols.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-400 flex items-start gap-2.5 text-xs relative z-10 leading-relaxed">
          <span className="font-extrabold">⚠️ {isAr ? "تنبيه:" : "Notice:"}</span>
          <span>
            {isAr 
              ? "لم تقم بتمييز أي أصل بنجمة حتى الآن! المنظومة تقوم مؤقتاً بالتحليل العادي الشامل لجميع الأصول. يرجى الضغط على رمز النجمة ⭐ بجانب أصولك المفضلة لتطبيق الفلترة تلقائياً."
              : "No assets have been starred yet! The platform is temporarily running analytical cycles on all assets. Please star your preferred pairs below to isolate focus."}
          </span>
        </div>
      )}

      {/* Table Data Base */}
      <div className="overflow-x-auto select-none rounded-xl">
        <table className="w-full text-left border-collapse min-w-[760px] relative z-10 font-sans">
          <thead>
            <tr className="border-b border-slate-800/60 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-950">
              <th className="py-4.5 px-3 select-none">{t.table.symbol}</th>
              <th className="py-4.5 px-3 text-right select-none">{t.table.price}</th>
              <th className="py-4.5 px-3 text-right select-none">{t.table.change}</th>
              <th className="py-4.5 px-3 text-right select-none">{t.table.rsi}</th>
              <th className="py-4.5 px-3 text-right select-none">{t.table.atr}</th>
              <th className="py-4.5 px-4 text-center select-none">{t.table.score}</th>
              <th className="py-4.5 px-4 text-center select-none">{t.table.trend}</th>
              <th className="py-4.5 px-4 text-center select-none">Trend spark</th>
              <th className="py-4.5 px-3 text-right select-none">{t.table.kill}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {assets.map((a) => {
              const changeIsPositive = a.changePct >= 0;
              const hasKill = !!a.killSwitch;
              const isFocused = focusedSymbols.includes(a.symbol);

              return (
                <tr
                  key={a.symbol}
                  className="hover:bg-slate-900/40 transition duration-150 text-xs font-medium text-slate-100/90"
                >
                  {/* Symbol with Star Toggle */}
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => onToggleFocusSymbol(a.symbol)}
                        className="transition duration-150 focus:outline-none focus:ring-0 p-1 rounded hover:bg-slate-900 cursor-pointer"
                        title={isAr ? "اضغط للمتابعة والتركيز" : "Click to tag focus"}
                      >
                        <Star className={`w-4 h-4 transition-all duration-200 ${
                          isFocused 
                            ? "text-amber-500 fill-amber-500 drop-shadow-[0_0_4px_rgba(245,158,11,0.3)]" 
                            : "text-slate-700 hover:text-amber-400/80 fill-none"
                        }`} />
                      </button>
                      <div>
                        <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                          <span>{a.symbol}</span>
                          {isFocused && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1 font-mono text-[9px]">
                          <span className="text-slate-500 uppercase">{a.category}</span>
                          {a.macdHistogram !== undefined && (
                            <span className={`px-1 py-0.5 rounded leading-none ${a.macdHistogram > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                              MACD: {a.macdHistogram > 0 ? "🟢 +" : "🔴 "}{(a.macdHistogram).toFixed(4)}
                            </span>
                          )}
                          {a.bbPercentB !== undefined && (
                            <span className={`px-1 py-0.5 rounded leading-none ${a.bbPercentB > 0.85 ? "bg-rose-500/10 text-rose-400 border border-rose-500/10" : a.bbPercentB < 0.15 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "bg-slate-900 text-slate-400"}`}>
                              %B: {a.bbPercentB.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-4 px-3 text-right font-mono font-bold text-slate-100">
                    <div>{formatPrice(a.price)}</div>
                    {a.supportPrice !== undefined && a.resistancePrice !== undefined && (
                      <div className="text-[9px] text-slate-500 font-normal mt-1 tracking-wider">
                        S: <span className="text-rose-400/85">{formatPrice(a.supportPrice)}</span> / R: <span className="text-emerald-400/85">{formatPrice(a.resistancePrice)}</span>
                      </div>
                    )}
                  </td>

                  {/* changePct */}
                  <td className={`py-4 px-3 text-right font-mono font-bold ${changeIsPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {changeIsPositive ? "+" : ""}
                    {a.changePct.toFixed(2)}%
                  </td>

                  {/* RSI */}
                  <td className="py-4 px-3 text-right font-mono text-slate-350">
                    <span className={a.rsi >= 70 ? "text-rose-400 font-bold" : a.rsi <= 30 ? "text-emerald-400 font-bold" : ""}>
                      {a.rsi.toFixed(1)}
                    </span>
                  </td>

                  {/* ATR % */}
                  <td className="py-4 px-3 text-right font-mono text-slate-400">
                    {a.atrPct.toFixed(3)}%
                  </td>

                  {/* Score */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex justify-center">
                      <span className={`px-2.5 py-1 rounded-lg border text-xs font-black font-mono tracking-wide ${getScoreColor(a.score)}`}>
                        {a.score}
                      </span>
                    </div>
                  </td>

                  {/* Trend Bias */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex justify-center">
                      {a.trend === "BUY" ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>{t.buy.split(" ")[0]}</span>
                        </span>
                      ) : a.trend === "SELL" ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />
                          <span>{t.sell.split(" ")[0]}</span>
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide">
                          {t.hold.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Interactive sparkline canvas trend */}
                  <td className="py-4 px-4">
                    <div className="flex justify-center">
                      <Sparkline data={a.hist.slice(-20)} isPositive={changeIsPositive} />
                    </div>
                  </td>

                  {/* Kill Switch */}
                  <td className="py-4 px-3 text-right">
                    {hasKill ? (
                      <span className="text-rose-400 bg-red-950/20 text-[10px] font-bold py-1 px-2.5 rounded-lg border border-red-500/20 block text-center max-w-40 ml-auto select-none" title={a.killSwitch || ""}>
                        {isAr ? "تحوط مفعل" : "SHIELDED"}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px] font-semibold tracking-wider font-mono">
                        {t.table.none}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
