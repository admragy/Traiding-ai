import React, { useState, useEffect, useRef } from "react";
import { Settings, Send, RefreshCw, Globe, HelpCircle, ShieldAlert, Cpu, Sparkles, Play, Square, Activity, ChevronDown, Copy, Check, Info } from "lucide-react";
import { translations } from "../translations";
import { TelegramConfig, RigorLevel, Category } from "../types";

interface SettingsSectionProps {
  config: TelegramConfig;
  onConfigChange: (c: TelegramConfig) => void;
  language: "en" | "ar";
  onLanguageChange: (lang: "en" | "ar") => void;
  onRunAnalysis: () => void;
  loading: boolean;
  status: string;
  rigor: RigorLevel;
  onRigorChange: (r: RigorLevel) => void;
  activeCategories: Exclude<Category, "all">[];
  theme: "carbon" | "matrix" | "amber" | "light";
  onThemeChange: (t: "carbon" | "matrix" | "amber" | "light") => void;
}

export default function SettingsSection({
  config,
  onConfigChange,
  language,
  onLanguageChange,
  onRunAnalysis,
  loading,
  status,
  rigor,
  onRigorChange,
  activeCategories,
  theme,
  onThemeChange,
}: SettingsSectionProps) {
  const t = translations[language];
  const isAr = language === "ar";

  const loadedConfigRef = useRef({ token: "", chatId: "" });
  const [testLoading, setTestLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [forceScanLoading, setForceScanLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ status: "success" | "error" | "none"; msg: string }>({ status: "none", msg: "" });
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const healthUrl = `${window.location.origin}/api/health`;
    navigator.clipboard.writeText(healthUrl);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  // Autopilot 24/7 background worker state
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autopilotInterval, setAutopilotInterval] = useState(180);
  const [autopilotDiags, setAutopilotDiags] = useState<{
    running: boolean;
    lastScanTime: string | null;
    scansCount: number;
    signalsSentCount: number;
    lastSignalSent: string | null;
    errorLog: string[];
    lastScanFindings?: string;
  } | null>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);

  const handleSendReport = async () => {
    if (!config.token || !config.chatId) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? "الرجاء كخطوة أولى إدخال التوكن ومعرّف القناة لإرسال التقرير!"
          : "Please insert Token and Chat ID first to send report!",
      });
      return;
    }
    setReportLoading(true);
    setTestFeedback({ status: "none", msg: "" });
    try {
      const res = await fetch("/api/autopilot/send-report", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Broadcast failed.");
      }
      setTestFeedback({
        status: "success",
        msg: isAr
          ? "🟢 تم بناء وإرسال البث والتقرير التحليلي الفوري بنجاح للتلغرام!"
          : "🟢 Custom analytical report successfully built & sent to Telegram!",
      });
    } catch (err: any) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? `عطل بالبث: ${err.message || "فشل غير معروف"}`
          : `Failed: ${err.message || "Unknown error"}`,
      });
    } finally {
      setReportLoading(false);
    }
  };

  // Load autopilot state on boot
  useEffect(() => {
    fetch("/api/autopilot/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setAutopilotEnabled(data.config.enabled);
          setAutopilotInterval(data.config.intervalMinutes || 180);
          loadedConfigRef.current = {
            token: (data.config.token || "").trim(),
            chatId: (data.config.chatId || "").trim(),
          };
          if ((data.config.token && !config.token) || (data.config.chatId && !config.chatId)) {
            onConfigChange({
              token: data.config.token || config.token,
              chatId: data.config.chatId || config.chatId,
              autoSend: config.autoSend,
            });
          }
        }
        if (data.diagnostics) {
          setAutopilotDiags(data.diagnostics);
        }
      })
      .catch((err) => console.error("Error loading Autopilot status:", err));
  }, []);

  // Poll diagnostics logs every 8 seconds for real-time live monitoring
  useEffect(() => {
    const intId = setInterval(() => {
      fetch("/api/autopilot/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.diagnostics) {
            setAutopilotDiags(data.diagnostics);
          }
        })
        .catch((e) => console.warn("Silent autopilot status poll failed:", e));
    }, 8000);
    return () => clearInterval(intId);
  }, []);

  const handleToggleAutopilot = async (newEnabled: boolean) => {
    if (newEnabled && (!config.token || !config.chatId)) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? "الرجاء كقشر أولى إدخال توكن البوت ومعرّف المحادثة لتشغيل الطيار الآلي!"
          : "Please enter Bot Token and Chat ID first to boot Autopilot!",
      });
      return;
    }
    setAutopilotLoading(true);
    try {
      const res = await fetch("/api/autopilot/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: newEnabled,
          token: config.token,
          chatId: config.chatId,
          rigor: rigor,
          intervalMinutes: autopilotInterval,
          activeCategories: activeCategories,
        }),
      });
      const data = await res.json();
      if (data.config) {
        setAutopilotEnabled(data.config.enabled);
        setAutopilotInterval(data.config.intervalMinutes);
      }
      if (data.diagnostics) {
        setAutopilotDiags(data.diagnostics);
      }
      setTestFeedback({
        status: "success",
        msg: isAr 
          ? (newEnabled ? "🟢 تم تشغيل اللوحات السحابية وتحفيز الطيار الآلي 24/7!" : "🔴 تم إيقاف الطيار الآلي بالكامل.")
          : (newEnabled ? "🟢 Autopilot initiated! Scanning server will run 24/7." : "🔴 Autopilot scanner shut down successfully."),
      });
    } catch (err: any) {
      console.error("Failed to save autopilot configuration:", err);
      setTestFeedback({
        status: "error",
        msg: isAr ? "فشل تفعيل الطيار الآلي السحابي" : "Failed to activate cloud Autopilot loop",
      });
    } finally {
      setAutopilotLoading(false);
    }
  };

  const handleUpdateInterval = async (val: number) => {
    const safeVal = Math.max(1, val);
    setAutopilotInterval(safeVal);
    // Auto-save if already running
    if (autopilotEnabled) {
      try {
        await fetch("/api/autopilot/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: true,
            token: config.token,
            chatId: config.chatId,
            rigor: rigor,
            intervalMinutes: safeVal,
            activeCategories: activeCategories,
          }),
        });
      } catch (err) {
        console.error("Auto-interval save failed:", err);
      }
    }
  };

  // Synchronize Autopilot server configuration if rigor or activeCategories changes on-the-fly while running
  useEffect(() => {
    if (autopilotEnabled && config.token && config.chatId) {
      const controller = new AbortController();
      fetch("/api/autopilot/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          enabled: true,
          token: config.token.trim(),
          chatId: config.chatId.trim(),
          rigor: rigor,
          intervalMinutes: autopilotInterval,
          activeCategories: activeCategories,
        }),
      }).catch((e) => console.log("Silent dynamic autopilot update failed:", e));
      return () => controller.abort();
    }
  }, [rigor, activeCategories, autopilotEnabled]);

  // Debounced auto-save credentials to server when edited
  useEffect(() => {
    if (!config.token || !config.chatId) return;

    // Skip saving if the credentials are exactly the same as loaded from the database on boot
    if (
      config.token.trim() === loadedConfigRef.current.token &&
      config.chatId.trim() === loadedConfigRef.current.chatId
    ) {
      return;
    }
    
    const delayDebounceId = setTimeout(() => {
      fetch("/api/autopilot/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: autopilotEnabled,
          token: config.token.trim(),
          chatId: config.chatId.trim(),
          rigor: rigor,
          intervalMinutes: autopilotInterval,
          activeCategories: activeCategories,
        }),
      })
      .then((res) => {
        if (res.ok) {
          loadedConfigRef.current = {
            token: config.token.trim(),
            chatId: config.chatId.trim(),
          };
        }
      })
      .catch((e) => console.log("Silent dynamic autopilot credentials sync failed:", e));
    }, 1200);

    return () => clearTimeout(delayDebounceId);
  }, [config.token, config.chatId]);

  const handleTestConnection = async () => {
    if (!config.token || !config.chatId) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? "الرجاء إدخال توكن البوت ومعرّف المحادثة أولاً!"
          : "Please insert Bot Token and Chat ID first!",
      });
      return;
    }

    setTestLoading(true);
    setTestFeedback({ status: "none", msg: "" });

    try {
      const res = await fetch("/api/autopilot/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: config.token.trim(),
          chatId: config.chatId.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Telegram verification rejected.");
      }

      setTestFeedback({
        status: "success",
        msg: isAr
          ? "تم إرسال إشارة الاتصال بنجاح! تفقد قناة تيليجرام."
          : "Heartbeat sentence sent successfully! Check Telegram.",
      });
    } catch (err: any) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? `خطأ: ${err.message || "عطل مجهول"}`
          : `Error: ${err.message || "Unknown error"}`,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleForceScanNow = async () => {
    if (!config.token || !config.chatId) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? "الرجاء إدخال توكن البوت ومعرّف القناة أولاً!"
          : "Please insert Token and Chat ID first!",
      });
      return;
    }
    setForceScanLoading(true);
    setTestFeedback({ status: "none", msg: "" });
    try {
      const res = await fetch("/api/autopilot/force-scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Immediate scan execution failed.");
      }
      setTestFeedback({
        status: "success",
        msg: isAr
          ? "🟢 تم تشغيل جرد المسوم وبث الإشارات الفورية المستحقة لتيليجرام بنجاح!"
          : "🟢 Immediate scan cycle ran successfully. Qualified signals sent to Telegram!",
      });
      if (data.diagnostics) {
        setAutopilotDiags(data.diagnostics);
      }
    } catch (err: any) {
      setTestFeedback({
        status: "error",
        msg: isAr
          ? `خطأ أثناء الفحص الفوري: ${err.message || "عطل غير معروف"}`
          : `Forced scan failed: ${err.message || "Unknown error"}`,
      });
    } finally {
      setForceScanLoading(false);
    }
  };

  // Map system codes to user-friendly messages
  const getStatusText = (s: string) => {
    if (s === "idle") return t.idle;
    if (s === "analyzed") return t.analyzed;
    if (s === "sent") return t.sent;
    if (s.startsWith("error:")) {
      return language === "ar"
        ? `عطل بالاتصال: ${s.replace("error:", "")}`
        : `Connection fail: ${s.replace("error:", "")}`;
    }
    return s;
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:border-indigo-500/30">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Settings className="w-5 h-5 animate-[spin_20s_infinite_linear]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{t.subtitle}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {isAr ? "قم بتهيئة قنوات وبوتات التنبيه التلقائي للمؤشرات والتحول الثنائي" : "Set Telegram API access keys and trigger live market scanning rules."}
            </p>
          </div>
        </div>

        {/* Global Language Switcher Toggle */}
        <button
          onClick={() => onLanguageChange(language === "en" ? "ar" : "en")}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-xs text-indigo-300 font-bold px-4 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition duration-200 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Globe className="w-4 h-4 text-indigo-400" />
          <span>{language === "en" ? "العربية (Arabic)" : "English (ENG)"}</span>
        </button>
      </div>

      {/* Inputs Stack */}
      <div className="space-y-4">
        {/* 1. Telegram Credentials & Test Connection (Collapsible Accordion) */}
        <details className="group border border-slate-800/80 rounded-2xl bg-slate-900/10 transition-all duration-300">
          <summary className="flex justify-between items-center p-4 cursor-pointer font-bold text-xs text-slate-300 select-none hover:text-white transition">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400 group-open:rotate-45 transition-transform" />
              <span>{isAr ? "إعدادات بث وبوت التيليجرام" : "Telegram Core Bot Credentials"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${config.token && config.chatId ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-550/20"}`}>
                {config.token && config.chatId ? (isAr ? "مكتمل ✓" : "CONFIGURED ✓") : (isAr ? "غير مكتمـل ⚠️" : "REQUIRED ⚠️")}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
            </div>
          </summary>
          
          <div className="p-4 border-t border-slate-800/60 bg-slate-950/45 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{t.botToken}</span>
                </label>
                <input
                  type="password"
                  value={config.token}
                  onChange={(e) => onConfigChange({ ...config, token: e.target.value })}
                  placeholder="e.g., 7392109861:AAH..."
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-700 font-mono transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{t.chatId}</span>
                </label>
                <input
                  type="text"
                  value={config.chatId}
                  onChange={(e) => onConfigChange({ ...config, chatId: e.target.value })}
                  placeholder="e.g., -10029381029"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-700 font-mono transition-all duration-200"
                />
              </div>
            </div>

            {/* Telegram Instant Connection Test */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/30 border border-slate-800/60 rounded-xl p-3">
              <div className="text-left">
                <h5 className="text-[10px] font-bold text-slate-350 uppercase tracking-wider">
                  {isAr ? "فحص الاتصال الفوري بالبوت" : "Live Heartbeat Handshake"}
                </h5>
                <p className="text-[9px] text-slate-500 leading-normal">
                  {isAr ? "أرسل نبضة فحص فنية سريعة للتحقق من عمل التنبيهات للبوت" : "Broadcast a quick technical telemetry test to confirm API connectivity."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {testFeedback.status !== "none" && (
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border leading-tight ${
                    testFeedback.status === "success"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                      : "text-rose-400 bg-rose-500/10 border-rose-500/25"
                  }`}>
                    {testFeedback.msg}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testLoading}
                  className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-400/40 text-indigo-300 text-[10px] font-black uppercase rounded-lg transition duration-150 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  {testLoading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-indigo-300" />
                      <span>{isAr ? "فحص..." : "Testing..."}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3 text-indigo-400" />
                      <span>{isAr ? "فحص الاتصال" : "Send Test"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </details>

        {/* Theme Settings row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-slate-900/30 border border-slate-800/60 rounded-xl gap-3">
          <div className="text-left">
            <h5 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-0.5">
              {isAr ? "سمة الواجهة والتصميم" : "Interface Theme Design"}
            </h5>
            <p className="text-[9px] text-slate-500 font-sans">
              {isAr ? "اختر نظام الألوان البصري المفضل" : "Select your preferred visual styling preset."}
            </p>
          </div>
          <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl self-stretch sm:self-auto gap-0.5 justify-center">
            {[
              { key: "carbon", labelEn: "Carbon", labelAr: "كربون" },
              { key: "matrix", labelEn: "Matrix", labelAr: "مصفوفة" },
              { key: "amber", labelEn: "Amber", labelAr: "كهرمان" },
              { key: "light", labelEn: "Daylight", labelAr: "نهار" },
            ].map((thOpt) => (
              <button
                key={thOpt.key}
                type="button"
                onClick={() => onThemeChange(thOpt.key as any)}
                className={`py-1 px-2.5 text-center text-[10px] font-bold rounded-lg cursor-pointer transition ${
                  theme === thOpt.key
                    ? "bg-indigo-600/90 text-white border border-indigo-500/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                }`}
              >
                {isAr ? thOpt.labelAr : thOpt.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* 24/7 Cloud Autopilot Controls card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border shrink-0 transition-colors ${
                autopilotEnabled 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse" 
                  : "bg-slate-950 border-slate-800 text-slate-500"
              }`}>
                <Cpu className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white tracking-tight">
                    {isAr ? "الطيار الآلي السحابي 24/7" : "24/7 Cloud Autopilot"}
                  </h4>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border leading-none ${
                    autopilotEnabled 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  }`}>
                    {autopilotEnabled ? (isAr ? "نشط 🟢" : "ACTIVE 🟢") : (isAr ? "متوقف 🔒" : "PAUSED 🔒")}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  {isAr ? "مسح آلي سحابي مستمر لبث الفرص دون توقف." : "Scans 24/7 in cloud background threads to publish trade updates."}
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <button
              onClick={() => handleToggleAutopilot(!autopilotEnabled)}
              disabled={autopilotLoading}
              className={`px-4 py-2 rounded-xl border text-[10px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 ${
                autopilotEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {autopilotEnabled ? (
                <>
                  <Square className="w-3 h-3 text-rose-400 fill-rose-400 animate-pulse" />
                  <span>{isAr ? "إيقاف السيرفر" : "Pause Scanner"}</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  <span>{isAr ? "تشغيل السيرفر" : "Resume Scanner"}</span>
                </>
              )}
            </button>
          </div>

          {/* Autopilot parameters and diagnostics (Collapsible Accordion keeping UI extremely clean) */}
          <details className="mt-4 border border-slate-850 rounded-xl bg-slate-950/40">
            <summary className="px-3 py-2 text-[10px] font-bold text-slate-400 select-none hover:text-slate-200 flex justify-between items-center cursor-pointer transition">
              <span>🛠️ {isAr ? "مراقبة الفواصل الفنية والتشخيص" : "Autopilot Intervals & Telemetry"}</span>
              <span className="text-[9px] text-slate-500 group-open:rotate-180">▼ / ▲</span>
            </summary>

            <div className="p-3 border-t border-slate-850 space-y-3">
              {/* Interval configurations */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isAr ? "فواصل المسح الفني" : "Scan interval minutes"}</span>
                </label>
                <div className="flex gap-0.5 bg-slate-950 p-1 border border-slate-800 rounded-xl max-w-sm">
                  {[
                    { label: "4m", labelAr: "٤ دقائق", val: 4 },
                    { label: "15m", labelAr: "١٥ دقيقة", val: 15 },
                    { label: "1h", labelAr: "ساعة", val: 60 },
                    { label: "4h", labelAr: "٤ ساعات", val: 240 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => handleUpdateInterval(opt.val)}
                      className={`flex-1 py-1 text-center text-[9px] font-bold rounded-lg cursor-pointer transition ${
                        autopilotInterval === opt.val
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      {isAr ? opt.labelAr : opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats & Telemetry logs */}
              <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-left space-y-1.5 text-[9.5px] font-mono leading-relaxed text-slate-400">
                <div className="flex justify-between">
                  <span>{isAr ? "عمليات المسح المكتملة:" : "Completed scans:"}</span>
                  <span className="text-slate-200 font-bold">{autopilotDiags?.scansCount || 0} cycles</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1">
                  <span>{isAr ? "إشارات تم بثها للمشتركين:" : "Signals broadcasted:"}</span>
                  <span className="text-emerald-400 font-bold">{autopilotDiags?.signalsSentCount || 0} targets</span>
                </div>
                <div className="col-span-2 border-t border-white/5 pt-1">
                  <span>{isAr ? "آخر دورة مسح سحابية:" : "Last scan & evaluation:"}</span>
                  <span className="text-slate-300 text-[9px] block font-semibold">
                    {autopilotDiags?.lastScanTime 
                      ? new Date(autopilotDiags.lastScanTime).toLocaleTimeString() 
                      : (isAr ? "لا يوجد بيانات" : "Waiting first scan...")}
                  </span>
                </div>
                {autopilotDiags?.lastScanFindings && (
                  <div className="col-span-2 border-t border-white/5 pt-1 text-xs font-sans">
                    <span className="text-slate-500 font-bold text-[9px] block uppercase">{isAr ? "💡 ملخص التقييم الأخير الأخير:" : "💡 LAST CYCLE FINDINGS:"}</span>
                    <p className="text-[9.5px] text-slate-300 italic mt-0.5 bg-slate-900/50 p-1.5 border border-slate-800 rounded">
                      {autopilotDiags.lastScanFindings}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-2 flex flex-col gap-1 text-[9px] leading-relaxed text-left">
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isAr ? "نبض بقاء الخادم الذاتي: نشِط" : "Self-Heartbeat Lock: ACTIVE"}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={reportLoading}
                  className="mt-1.5 w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 hover:text-white text-[9.5px] font-black uppercase rounded-lg transition cursor-pointer disabled:opacity-45 flex items-center justify-center gap-1"
                >
                  {reportLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-2.5 h-2.5" />}
                  <span>{isAr ? "بث التقرير الشامل الآن للتيليجرام" : "Broadcast Market Report to Telegram"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleForceScanNow}
                  disabled={forceScanLoading}
                  className="mt-1.5 w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:text-white text-[9.5px] font-black uppercase rounded-lg transition cursor-pointer disabled:opacity-45 flex items-center justify-center gap-1"
                >
                  {forceScanLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-2.5 h-2.5 text-emerald-400" />}
                  <span>{isAr ? "فحص فوري وبث الإشارات المحتملة الآن" : "Trigger Immediate Scan & Dispatch Now"}</span>
                </button>

                {/* 24/7 Keep-Alive Guide */}
                <div className="mt-3.5 p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/15 text-left text-xs leading-normal">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1.5">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      {isAr 
                        ? "الضمان الفائق للعمل 24/7 (دون نوم الخادم)" 
                        : "Ensure 24/7 Delivery (Prevent Server Sleep)"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans mb-3 leading-relaxed">
                    {isAr 
                      ? "تطبيقك مستضاف سحابياً. عند غلق هاتفك وعدم استخدام الموقع لـ 15 دقيقة، تغفو الخوادم لتوفير الطاقة. لضمان عدم غفلتها وإرسال الإشارات بانتظام في ميعادها بدقة:" 
                      : "The server on Cloud Run sleeps when there is active inactivity (after ~15 mins of no visitors). To keep the bot awake and sending telegram signals continuously 24/7:"}
                  </p>
                  <ol className="text-[9.5px] text-slate-300 list-decimal list-inside space-y-1 mb-3.5 font-sans">
                    {isAr ? (
                      <>
                        <li>سجّل مجاناً بموقع مراقبة مثل <a href="https://uptimerobot.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">UptimeRobot.com</a></li>
                        <li>قم بإضافة مسبار جديد من نوع <b>HTTP(s) Monitor</b></li>
                        <li>الصق رابط الحيوية أدناه، واجعل التكرار كل <b>5 دقائق</b> لضمان يقظة البوت المستمرة!</li>
                      </>
                    ) : (
                      <>
                        <li>Register a free account on <a href="https://uptimerobot.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline text-indigo-300">UptimeRobot.com</a> or similar.</li>
                        <li>Create a new monitoring check of type <b>HTTP(s) Monitor</b>.</li>
                        <li>Paste your unique health link below and set it to check/ping every <b>5 minutes</b>.</li>
                      </>
                    )}
                  </ol>
                  
                  <div className="bg-slate-950 border border-slate-850 rounded-lg p-2 flex items-center justify-between gap-2 font-mono">
                    <span className="text-[9px] text-zinc-400 text-left select-all overflow-x-auto whitespace-nowrap scrollbar-none flex-1">
                      {typeof window !== "undefined" ? window.location.origin : ""}/api/health
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-600 border border-indigo-550/20 text-white rounded text-[9px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
                    >
                      {copied ? <Check className="w-3" /> : <Copy className="w-3" />}
                      <span>{copied ? (isAr ? "تم النسخ!" : "Copied!") : (isAr ? "نسخ الرابط" : "Copy Link")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Genuine Signal Strength Filters */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-3.5">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-sans">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? "تصفية جودة وقوة التقييم الفني" : "Trade Execution Rigor & Strictness"}</span>
            </h4>
          </div>

          {/* Sleek inline segmented control tab bar */}
          <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl gap-0.5">
            {[
              { key: "normal", labelAr: "مؤشرات قياسية", labelEn: "Standard (Score 75+)" },
              { key: "strict", labelAr: "فحص صارم", labelEn: "Strict (Score 80+)" },
              { key: "elite", labelAr: "حارس النخبة الفائق", labelEn: "Elite (Score 85+)" },
            ].map((opt) => {
              const isActive = rigor === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onRigorChange(opt.key as RigorLevel)}
                  className={`flex-1 py-2 text-center text-[10px] font-black rounded-lg cursor-pointer transition ${
                    isActive
                      ? "bg-indigo-600/90 text-white border border-indigo-500/20 shadow-sm"
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Diagnostics */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3">
          <button
            onClick={onRunAnalysis}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-slate-950 font-extrabold px-5 py-3.5 rounded-xl text-xs tracking-wider uppercase transition shadow-lg shadow-indigo-500/10 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>{t.analyzing}</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-slate-950" />
                <span>{t.analyzeBtn}</span>
              </>
            )}
          </button>

          <button
            onClick={() => onConfigChange({ ...config, autoSend: !config.autoSend })}
            className={`px-5 py-3.5 rounded-xl border text-xs font-bold tracking-wider uppercase transition cursor-pointer text-center flex items-center justify-center gap-2 ${
              config.autoSend
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <Send className={`w-4 h-4 ${config.autoSend ? "text-emerald-400 animate-pulse" : ""}`} />
            <span>{config.autoSend ? t.autoSendOn : t.autoSendOff}</span>
          </button>
        </div>

        {/* Real-time Status Card */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-3.5 flex flex-wrap gap-3 justify-between items-center mt-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.status}:</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${status === "sent" ? "bg-emerald-400 animate-ping" : status === "analyzed" ? "bg-indigo-400 animate-pulse" : status.startsWith("error") ? "bg-rose-500" : "bg-slate-600 animate-pulse"}`}></span>
              <span className={`text-xs font-semibold ${status === "sent" ? "text-emerald-400" : status === "analyzed" ? "text-indigo-400" : status.startsWith("error") ? "text-rose-400" : "text-slate-300"}`}>
                {getStatusText(status)}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            GMT: {new Date().toISOString().substring(11, 16)} • {isAr ? "بث مشفر" : "UTC Engine Secured"}
          </span>
        </div>
      </div>
    </div>
  );
}
