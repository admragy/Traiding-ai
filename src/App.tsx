import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Trophy, ShieldAlert, Send, Flame, Cpu, HelpCircle, ChevronDown, ChevronUp, AlertCircle, Globe } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Asset, Signal, Analysis, Regime, Trend, Category, TelegramConfig, RigorLevel, ThemeType } from "./types";
import { seeded, ema, rsi, atrPct, buildHistory, scoreAsset, regimeLabel, proposeSignal, buildAnalysis } from "./lib/analytics";
import { translations } from "./translations";

import SettingsSection from "./components/SettingsSection";
import MarketStateSection from "./components/MarketStateSection";
import SignalsPanel from "./components/SignalsPanel";
import UniverseTable from "./components/UniverseTable";
import FinancialAdvisorPanel from "./components/FinancialAdvisorPanel";

const PAIRS = [
  // ======= Forex (20 pairs) =======
  { symbol: "EUR/USD", category: "forex" as const, base: 1.0842, vol: 0.0011, spread: 0.00008 },
  { symbol: "GBP/USD", category: "forex" as const, base: 1.2671, vol: 0.0013, spread: 0.00010 },
  { symbol: "USD/JPY", category: "forex" as const, base: 157.24, vol: 0.1400, spread: 0.01500 },
  { symbol: "AUD/USD", category: "forex" as const, base: 0.6654, vol: 0.0008, spread: 0.00007 },
  { symbol: "USD/CAD", category: "forex" as const, base: 1.3685, vol: 0.0010, spread: 0.00009 },
  { symbol: "USD/CHF", category: "forex" as const, base: 0.8975, vol: 0.0009, spread: 0.00008 },
  { symbol: "NZD/USD", category: "forex" as const, base: 0.6125, vol: 0.0007, spread: 0.00008 },
  { symbol: "EUR/GBP", category: "forex" as const, base: 0.8550, vol: 0.0006, spread: 0.00006 },
  { symbol: "EUR/JPY", category: "forex" as const, base: 170.50, vol: 0.1500, spread: 0.01800 },
  { symbol: "GBP/JPY", category: "forex" as const, base: 199.20, vol: 0.1800, spread: 0.02200 },
  { symbol: "EUR/AUD", category: "forex" as const, base: 1.6290, vol: 0.0016, spread: 0.00015 },
  { symbol: "EUR/CAD", category: "forex" as const, base: 1.4830, vol: 0.0012, spread: 0.00012 },
  { symbol: "AUD/JPY", category: "forex" as const, base: 104.60, vol: 0.1200, spread: 0.01600 },
  { symbol: "CHF/JPY", category: "forex" as const, base: 175.20, vol: 0.1600, spread: 0.02000 },
  { symbol: "CAD/JPY", category: "forex" as const, base: 114.80, vol: 0.1100, spread: 0.01500 },
  { symbol: "GBP/CAD", category: "forex" as const, base: 1.7340, vol: 0.0018, spread: 0.00018 },
  { symbol: "NZD/JPY", category: "forex" as const, base: 96.30, vol: 0.1000, spread: 0.01500 },
  { symbol: "EUR/CHF", category: "forex" as const, base: 0.9730, vol: 0.0008, spread: 0.00009 },
  { symbol: "GBP/CHF", category: "forex" as const, base: 1.1380, vol: 0.0011, spread: 0.00014 },
  { symbol: "AUD/CAD", category: "forex" as const, base: 0.9100, vol: 0.0009, spread: 0.00010 },

  // ======= Gold & Commodities (7 pairs) =======
  { symbol: "XAU/USD", category: "gold" as const, base: 2318.5, vol: 2.1000, spread: 0.35000 },
  { symbol: "XAG/USD", category: "gold" as const, base: 29.50, vol: 0.0500, spread: 0.00800 },
  { symbol: "USOIL", category: "gold" as const, base: 78.40, vol: 0.1200, spread: 0.02000 },
  { symbol: "UKOIL", category: "gold" as const, base: 82.50, vol: 0.1300, spread: 0.02000 },
  { symbol: "NGAS", category: "gold" as const, base: 2.85, vol: 0.0120, spread: 0.00400 },
  { symbol: "COPPER", category: "gold" as const, base: 4.52, vol: 0.0080, spread: 0.00200 },
  { symbol: "PLATINUM", category: "gold" as const, base: 975.0, vol: 1.5000, spread: 0.45000 },

  // ======= Cryptocurrencies (30 pairs) =======
  { symbol: "BTC/USD", category: "crypto" as const, base: 67420, vol: 260.00, spread: 12.0000 },
  { symbol: "ETH/USD", category: "crypto" as const, base: 3812, vol: 22.00, spread: 2.5000 },
  { symbol: "SOL/USD", category: "crypto" as const, base: 178.4, vol: 2.20, spread: 0.3500 },
  { symbol: "BNB/USD", category: "crypto" as const, base: 605.5, vol: 4.50, spread: 0.8000 },
  { symbol: "XRP/USD", category: "crypto" as const, base: 0.4950, vol: 0.006, spread: 0.0010 },
  { symbol: "TON/USD", category: "crypto" as const, base: 7.25, vol: 0.150, spread: 0.0200 },
  { symbol: "ADA/USD", category: "crypto" as const, base: 0.4250, vol: 0.005, spread: 0.0008 },
  { symbol: "DOGE/USD", category: "crypto" as const, base: 0.1420, vol: 0.003, spread: 0.0004 },
  { symbol: "AVAX/USD", category: "crypto" as const, base: 32.40, vol: 0.45, spread: 0.0800 },
  { symbol: "DOT/USD", category: "crypto" as const, base: 6.45, vol: 0.08, spread: 0.0150 },
  { symbol: "LINK/USD", category: "crypto" as const, base: 15.80, vol: 0.22, spread: 0.0400 },
  { symbol: "NEAR/USD", category: "crypto" as const, base: 6.12, vol: 0.12, spread: 0.0200 },
  { symbol: "MATIC/USD", category: "crypto" as const, base: 0.6420, vol: 0.008, spread: 0.0012 },
  { symbol: "LTC/USD", category: "crypto" as const, base: 78.50, vol: 0.85, spread: 0.1500 },
  { symbol: "BCH/USD", category: "crypto" as const, base: 455.0, vol: 6.20, spread: 1.2000 },
  { symbol: "UNI/USD", category: "crypto" as const, base: 9.80, vol: 0.15, spread: 0.0300 },
  { symbol: "PEPE/USD", category: "crypto" as const, base: 0.000012, vol: 0.0000003, spread: 0.00000002 },
  { symbol: "APT/USD", category: "crypto" as const, base: 8.24, vol: 0.15, spread: 0.0300 },
  { symbol: "SUI/USD", category: "crypto" as const, base: 1.15, vol: 0.025, spread: 0.0040 },
  { symbol: "ICP/USD", category: "crypto" as const, base: 10.15, vol: 0.18, spread: 0.0300 },
  { symbol: "OP/USD", category: "crypto" as const, base: 2.12, vol: 0.04, spread: 0.0080 },
  { symbol: "ARB/USD", category: "crypto" as const, base: 0.9500, vol: 0.015, spread: 0.0020 },
  { symbol: "FTM/USD", category: "crypto" as const, base: 0.7650, vol: 0.012, spread: 0.0020 },
  { symbol: "RNDR/USD", category: "crypto" as const, base: 8.45, vol: 0.18, spread: 0.0300 },
  { symbol: "FIL/USD", category: "crypto" as const, base: 5.65, vol: 0.08, spread: 0.0150 },
  { symbol: "SHIB/USD", category: "crypto" as const, base: 0.000021, vol: 0.0000006, spread: 0.00000004 },
  { symbol: "LDO/USD", category: "crypto" as const, base: 1.85, vol: 0.04, spread: 0.0060 },
  { symbol: "FET/USD", category: "crypto" as const, base: 1.62, vol: 0.035, spread: 0.0050 },
  { symbol: "ATOM/USD", category: "crypto" as const, base: 8.15, vol: 0.12, spread: 0.0200 },
  { symbol: "GRT/USD", category: "crypto" as const, base: 0.2240, vol: 0.004, spread: 0.0006 },

  // ======= Indices (8 pairs) =======
  { symbol: "SPX500", category: "indices" as const, base: 5420, vol: 15.00, spread: 0.6000 },
  { symbol: "NAS100", category: "indices" as const, base: 19650, vol: 65.00, spread: 2.2000 },
  { symbol: "US30", category: "indices" as const, base: 38980, vol: 120.00, spread: 4.5000 },
  { symbol: "GER30", category: "indices" as const, base: 18550, vol: 55.00, spread: 2.0000 },
  { symbol: "UK100", category: "indices" as const, base: 8240, vol: 22.00, spread: 1.0000 },
  { symbol: "FRA40", category: "indices" as const, base: 7950, vol: 24.00, spread: 1.0000 },
  { symbol: "JPN225", category: "indices" as const, base: 38800, vol: 140.00, spread: 5.0000 },
  { symbol: "HK50", category: "indices" as const, base: 17950, vol: 85.00, spread: 3.5000 }
];

async function sendTelegramMessage(token: string, chatId: string, text: string, pair?: string, direction?: "BUY" | "SELL") {
  const res = await fetch("/api/telegram/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: token.trim(),
      chatId: chatId.trim(),
      text,
      pair,
      direction,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Telegram API message delivery failed.");
  return data;
}

export default function App() {
  // Saved Language Toggle
  const [language, setLanguage] = useState<"en" | "ar">(() => {
    const saved = localStorage.getItem("nexus_lang_v1");
    return saved === "ar" ? "ar" : "en";
  });

  // Saved Theme Toggle
  const [theme, setTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("nexus_theme_v1");
    return (saved as ThemeType) || "carbon";
  });

  const t = translations[language];

  // Saved Telegram Bot Setup
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem("nexus_tele_v1");
    return saved
      ? JSON.parse(saved)
      : { token: "", chatId: "", autoSend: false };
  });

  const [seed] = useState(() => Date.now() % 100000);
  const [ticks, setTicks] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<"all" | Category>("all");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("idle");

  // Saved Rigor Level
  const [rigor, setRigor] = useState<RigorLevel>(() => {
    const saved = localStorage.getItem("nexus_rigor_v1");
    return (saved as RigorLevel) || "normal";
  });

  // Strict Asset Portfolio Focus State
  const [focusedSymbols, setFocusedSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem("nexus_focused_symbols_v2");
    return saved ? JSON.parse(saved) : [];
  });

  const [focusOnlyMode, setFocusOnlyMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("nexus_focus_only_mode_v2");
    return saved === "true";
  });

  // Active Categories State for entire scan engine (Forex, Crypto, Gold, Indices)
  const [activeCategories, setActiveCategories] = useState<Exclude<Category, "all">[]>(() => {
    const saved = localStorage.getItem("nexus_active_categories_v2");
    return saved ? JSON.parse(saved) : ["forex", "crypto", "gold", "indices"];
  });

  const handleToggleActiveCategory = (category: Exclude<Category, "all">) => {
    setActiveCategories((prev) => {
      const next = prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category];
      // Keep at least one category active to avoid blank scans
      return next.length > 0 ? next : prev;
    });
  };

  const handleToggleFocusSymbol = (symbol: string) => {
    setFocusedSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  // AI coach interactive panel
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachCommentary, setCoachCommentary] = useState<string>("");
  const [coachLoading, setCoachLoading] = useState(false);

  // Periodic ticks to simulate volatile prices & animate sparklines live
  useEffect(() => {
    const interval = setInterval(() => {
      setTicks((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute live fluctuating prices
  const assets = useMemo(() => {
    return PAIRS.map((p, idx) => {
      const itemSeed = seed + idx * 431;
      const rand = seeded(itemSeed);
      const hist = buildHistory(p.base, p.vol, rand);

      // Add a slight micro price swing based on current ticks
      const swingRange = (Math.sin(ticks * 0.35 + idx) * 0.0012) + (Math.cos(ticks * 0.14 + idx * 3) * 0.0004);
      const lastPriceVal = hist[hist.length - 1];
      const price = Math.max(0.0001, lastPriceVal * (1 + swingRange));

      // Re-create history shift to simulate real ticker charts
      const shiftedHist = [...hist.slice(1), price];

      const scoredObj = {
        symbol: p.symbol,
        category: p.category,
        price,
        changePct: ((price - p.base) / p.base) * 100,
        spreadPct: (p.spread / p.base) * 100,
        atrPct: atrPct(shiftedHist),
        rsi: rsi(shiftedHist),
        emaFast: ema(shiftedHist.slice(-20), 20),
        emaSlow: ema(shiftedHist.slice(-50), 50),
        volumeScore: Math.round(35 + rand() * 65),
        structureScore: Math.round(30 + rand() * 70),
        liquidityScore: Math.round(25 + rand() * 75),
        hist: shiftedHist,
      };

      return scoreAsset(scoredObj);
    });
  }, [seed, ticks]);

  // Extract custom active focus assets if focusOnlyMode is active and focused list has items, respecting active market classes
  const assetsToAnalyze = useMemo(() => {
    let filtered = assets.filter((a) => activeCategories.includes(a.category));
    if (focusOnlyMode && focusedSymbols.length > 0) {
      filtered = filtered.filter((a) => focusedSymbols.includes(a.symbol));
    }
    return filtered;
  }, [assets, activeCategories, focusOnlyMode, focusedSymbols]);

  // Derive static Analysis
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    if (assetsToAnalyze.length > 0) {
      setAnalysis(buildAnalysis(assetsToAnalyze, rigor));
    } else {
      setAnalysis(null);
    }
  }, [assetsToAnalyze, rigor]);

  // Sync states
  useEffect(() => {
    localStorage.setItem("nexus_lang_v1", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("nexus_theme_v1", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("nexus_rigor_v1", rigor);
  }, [rigor]);

  useEffect(() => {
    localStorage.setItem("nexus_tele_v1", JSON.stringify(telegramConfig));
  }, [telegramConfig]);

  useEffect(() => {
    localStorage.setItem("nexus_focused_symbols_v2", JSON.stringify(focusedSymbols));
  }, [focusedSymbols]);

  useEffect(() => {
    localStorage.setItem("nexus_active_categories_v2", JSON.stringify(activeCategories));
  }, [activeCategories]);

  useEffect(() => {
    localStorage.setItem("nexus_focus_only_mode_v2", focusOnlyMode ? "true" : "false");
  }, [focusOnlyMode]);

  // Run whole engine
  const handleRunAnalysis = async () => {
    if (!analysis) return;
    setLoading(true);
    setStatus("analyzed");

    // Force recalculate setup
    const freshAnalysis = buildAnalysis(assetsToAnalyze, rigor);
    setAnalysis(freshAnalysis);

    if (telegramConfig.autoSend && telegramConfig.token && telegramConfig.chatId && freshAnalysis.signals.length > 0) {
      try {
        for (const s of freshAnalysis.signals) {
          const isAr = language === "ar";
          const buyTextEn = s.dirEn === "BUY" ? "🟢 BUY (Bullish LONG)" : "🔴 SELL (Bearish SHORT)";
          const buyTextAr = s.dirEn === "BUY" ? "🟢 شراء (صفقة صعودية)" : "🔴 بيع (صفقة هبوطية)";

          const scoreVal = s.score || 85;
          const barFilled = Math.min(10, Math.round(scoreVal / 10));
          const barVisual = "█".repeat(barFilled) + "░".repeat(10 - barFilled);

          const formattedText = 
            `💎 <b>NEXUS ELITE™ ALGORITHMIC PROTOCOL</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚙️ <b>CONFIRMED LIVE MARKET SIGNAL (Tension: Manual Run)</b>\n\n` +
            `📈 <b>ASSET | الأصل:</b> <code>${s.pair}</code>\n` +
            `🏷️ <b>ACTION | الاتجاه:</b> <b>${buyTextEn}</b>\n` +
            `      └─ 🇸🇦 <b>${buyTextAr}</b>\n\n` +
            `🎚️ <b>CONFIDENCE | القوة والجاهزية:</b>\n` +
            `<code>[ ${barVisual} ] ${scoreVal}%</code> 🔥\n\n` +
            `⚙️ <b>RIGOR MODE:</b> <code>${rigor.toUpperCase()}</code> (${s.confidence.toUpperCase()})\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📥 <b>ENTRY RANGE | منطقة الدخول المناسبة:</b>\n` +
            `<code>▶️ ${s.entry_low.toFixed(5)}  —─  ${s.entry_high.toFixed(5)} ◀️</code>\n\n` +
            `🚨 <b>STOP-LOSS | حد وقف الخسارة الصارم:</b>\n` +
            `<code>❌ ${s.stop_loss.toFixed(5)}</code>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎯 <b>PROFIT TARGETS | مستهدفات جني الأرباح:</b>\n` +
            `  ├─ 🔹 <b>Target 1:</b> <code>${s.target1.toFixed(5)}</code>\n` +
            `  ├─ 🔹 <b>Target 2:</b> <code>${s.target2.toFixed(5)}</code>\n` +
            `  └─ 🏆 <b>Target 3:</b> <b><code>${s.target3.toFixed(5)}</code></b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚖️ <b>RISK/REWARD | نسبة العائد للمخاطرة:</b> <code>${s.rr}</code>\n` +
            `🛡️ <b>PROTOCOL TYPE | النمط الفني:</b> <code>${s.trade_type.toUpperCase()} Execution</code>\n` +
            `⏰ <b>DURATION | المدى الزمني المتوقع:</b>\n` +
            `  ├─ 🇸🇦 <code>${s.estimatedDurationAr}</code>\n` +
            `  └─ 🇬🇧 <code>${s.estimatedDurationEn}</code>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 <b>EXIT TACTICS | خطة وتكتيك الخروج:</b>\n` +
            `  ├─ 🇸🇦 <i>${s.exitStrategyAr}</i>\n` +
            `  └─ 🇬🇧 <i>${s.exitStrategyEn}</i>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 <b>TECHNICAL ANALYTICS | التحليل والسبب الفني:</b>\n` +
            `🇸🇦 <i>${s.reasonAr || s.reason}</i>\n\n` +
            `🇬🇧 <i>${s.reason}</i>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📡 <i>Autonomous execution via Nexus Cloud Core Infrastructure.</i>`;

          const resData = await sendTelegramMessage(
            telegramConfig.token,
            telegramConfig.chatId,
            formattedText,
            s.pair,
            s.dirEn as "BUY" | "SELL"
          );
          if (resData && resData.suppressed) {
            console.log(`[UI AutoSend] Signal delivery suppressed: ${resData.reason}`);
          }
        }
        setStatus("sent");
      } catch (err: any) {
        console.error("Telegram broadcast warning:", err);
        setStatus(`error: ${err.message || "Fetch fail"}`);
      }
    }

    // Pull Fresh AI commentary automatically if panel is expanded
    if (coachOpen) {
      fetchAICoachInsights(freshAnalysis);
    }

    setLoading(false);
  };

  const fetchAICoachInsights = async (targetAnalysis = analysis) => {
    if (!targetAnalysis) return;
    setCoachLoading(true);
    try {
      const r = await fetch("/api/trade-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regime: targetAnalysis.regime,
          signals: targetAnalysis.signals,
          language,
        }),
      });
      const data = await r.json();
      setCoachCommentary(data.commentary);
    } catch (e) {
      console.error(e);
    } finally {
      setCoachLoading(false);
    }
  };

  // Immediate fetch upon Coach panel expansion or language change
  useEffect(() => {
    if (coachOpen && analysis) {
      fetchAICoachInsights();
    }
  }, [coachOpen, language]);

  const filteredAssets = assets.filter((a) => selectedCategory === "all" || a.category === selectedCategory);

  const isAr = language === "ar";

  const themeWrapperClass = 
    theme === "matrix"
      ? "theme-matrix bg-zinc-950 text-emerald-400 font-mono"
      : theme === "amber"
      ? "theme-amber bg-stone-950 text-amber-500"
      : theme === "light"
      ? "theme-light bg-slate-50 text-slate-850"
      : "theme-carbon bg-slate-950 text-slate-100";

  return (
    <div
      id="nexus-app-container"
      className={`${themeWrapperClass} ${isAr ? "font-arabic" : (theme === "matrix" ? "font-mono" : "font-sans")} min-h-screen shrink-0 overflow-x-hidden antialiased pb-12 select-none`}
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Top Background Cyber Light Lines */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent pointer-events-none z-10"></div>

      {/* Main Terminal Header bar */}
      <header id="nexus-header-bar" className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center border border-indigo-500/50 shadow-lg shadow-indigo-600/20">
                <Cpu className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-tight uppercase">Nexus Elite</span>
                <span className="text-[10px] font-bold bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded uppercase">PRO Term</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">Global Trading Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Language Switch Button in Header */}
            <button
              id="nexus-header-lang-switcher"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition duration-200 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-405" />
              <span>{isAr ? "English" : "العربية"}</span>
            </button>

            <span className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-mono text-slate-400">
              TICK FEED: #{ticks}
            </span>
          </div>
        </div>
      </header>

      {/* Main Control Center layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        <div id="nexus-main-columns-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Column (8-Spans) - Active Work Zone */}
          <div id="nexus-left-matrix-column" className="lg:col-span-12 xl:col-span-8 space-y-6">
            
            {/* Signals Section */}
            {analysis && (
              <SignalsPanel
                signals={analysis.signals}
                noTradeMessageEn={analysis.no_trade_message}
                noTradeMessageAr={analysis.no_trade_message_ar}
                language={language}
              />
            )}

            {/* Algorithmic Sizer & Portfolio Advisor Module */}
            {analysis && (
              <FinancialAdvisorPanel
                signals={analysis.signals}
                marketRegime={analysis.regime}
                language={language}
              />
            )}

            {/* Execution Universe Table */}
            <UniverseTable
              assets={filteredAssets}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              language={language}
              focusedSymbols={focusedSymbols}
              onToggleFocusSymbol={handleToggleFocusSymbol}
              focusOnlyMode={focusOnlyMode}
              onToggleFocusOnlyMode={() => setFocusOnlyMode(!focusOnlyMode)}
              activeCategories={activeCategories}
              onToggleActiveCategory={handleToggleActiveCategory}
            />
          </div>

          {/* Sidebar Operations Column (4-Spans) - Settings & Guidelines */}
          <div id="nexus-right-sidebar-column" className="lg:col-span-12 xl:col-span-4 space-y-6">
            
            {/* Market State Regime Card */}
            {analysis && (
              <MarketStateSection
                regime={analysis.regime}
                assessmentEn={analysis.market_assessment}
                assessmentAr={analysis.market_assessment_ar}
                language={language}
              />
            )}

            {/* Configuration Settings (Telegram credentials & Autopilot controls) */}
            <SettingsSection
              config={telegramConfig}
              onConfigChange={setTelegramConfig}
              language={language}
              onLanguageChange={setLanguage}
              onRunAnalysis={handleRunAnalysis}
              loading={loading}
              status={status}
              rigor={rigor}
              onRigorChange={setRigor}
              activeCategories={activeCategories}
              theme={theme}
              onThemeChange={setTheme}
            />

            {/* AI Trade Coach commentary interactive section */}
            <div id="nexus-ai-coach-card" className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden transition-all duration-300 hover:border-indigo-500/20">
              <button
                onClick={() => setCoachOpen(!coachOpen)}
                className="w-full flex items-center justify-between p-5 bg-slate-900/40 hover:bg-slate-900/85 transition duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 self-center">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-[pulse_2s_infinite]" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{isAr ? "مستشار تداول نيكسس الذكي (AI Insight)" : "Nexus AI Trading Coach"}</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isAr ? "توجيهات فنية ماكرو مفصلة لبيانات الصوت الحالية بتنسيق النموذج اللغوي الذكي" : "Macro regime analysis, entry advice, and emotional guardrails from Gemini."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 tracking-wider">
                    {coachOpen ? (isAr ? "إغلاق" : "HIDE") : (isAr ? "عرض" : "EXPAND")}
                  </span>
                  {coachOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {coachOpen && (
                <div className="p-5 border-t border-slate-905 bg-slate-950/40">
                  {coachLoading ? (
                    <div id="ai-coach-spinner" className="py-8 flex flex-col items-center justify-center gap-2.5">
                      <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                      <span className="text-[11px] text-slate-500 tracking-wide font-mono animate-pulse">
                        {isAr ? "استدعاء التحاليل من Gemini..." : "Consulting Gemini intelligence..."}
                      </span>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-xs text-slate-450 leading-relaxed font-sans prose-headings:text-white prose-a:text-indigo-400 prose-strong:text-indigo-200 prose-code:text-indigo-300">
                      <ReactMarkdown>{coachCommentary || (isAr ? "لا توجد أي تحليلات ذكية مستوردة حالياً؛ الرجاء تشغيل محرك التحليلات لتوليد تقارير Gemini." : "No live AI analysis imported; please run the analytics engine to generate Gemini review.")}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Small Legal Footer */}
      <footer id="nexus-app-footer" className="max-w-7xl mx-auto px-4 md:px-6 mt-12 border-t border-slate-900 pt-6 text-center">
        <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase mb-1">
          Nexus Elite trading intelligence terminal
        </p>
        <p className="text-[9px] text-slate-700 max-w-md mx-auto leading-relaxed">
          {isAr
            ? "الأسواق المالية تحمل مخاطر عالية جداً؛ التحليلات بالمنصة هي نتاج حسابات فنية إرشادية وتدريبية ولا تعتبر مشورة استثمارية مباشرة."
            : "Finances involve substantial risk. Visualized indices are derived strictly from technical signals. No direct investment recommendation is guaranteed."}
        </p>
      </footer>
    </div>
  );
}
