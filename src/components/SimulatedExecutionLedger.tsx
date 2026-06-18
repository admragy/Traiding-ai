import React, { useState, useEffect } from "react";
import { Play, Square, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, CheckCircle, Database } from "lucide-react";
import { Signal, SimulatedTrade, SimulatedAccount } from "../types";

interface SimulatedExecutionLedgerProps {
  signals: Signal[];
  language: "en" | "ar";
}

export default function SimulatedExecutionLedger({ signals, language }: SimulatedExecutionLedgerProps) {
  const isAr = language === "ar";

  // Bot mode
  const [isRunning, setIsRunning] = useState<boolean>(() => {
    return localStorage.getItem("simBot_running") === "true";
  });

  const [account, setAccount] = useState<SimulatedAccount>(() => {
    const saved = localStorage.getItem("simBot_account");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      balance: 10000,
      initialBalance: 10000,
      pnlHistory: [{ timestamp: new Date().toISOString(), balance: 10000 }]
    };
  });

  const [trades, setTrades] = useState<SimulatedTrade[]>(() => {
    const saved = localStorage.getItem("simBot_trades");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [logs, setLogs] = useState<string[]>(() => {
    const saved = localStorage.getItem("simBot_logs");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      isAr 
        ? "🤖 نظام الروبوت جاهز للعمل. قم بتفعيل المستشار الذكي لبدء العمليات الفورية." 
        : "🤖 Elite SimBot Ready. Activate automatic trade tracking."
    ];
  });

  // Save states
  useEffect(() => {
    localStorage.setItem("simBot_running", isRunning.toString());
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem("simBot_account", JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    localStorage.setItem("simBot_trades", JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem("simBot_logs", JSON.stringify(logs));
  }, [logs]);

  // Keep simulated price fluctuation running for open positions to show live floating P&L updates!
  useEffect(() => {
    if (!isRunning || trades.length === 0) return;

    const interval = setInterval(() => {
      let changed = false;
      const updatedTrades = trades.map((t): SimulatedTrade => {
        if (t.status !== "OPEN" && !t.status.startsWith("TP")) return t;

        // Simulate tiny realistic price movement using a random walk
        const percentChange = (Math.random() - 0.5) * 0.001; // +/- 0.05%
        const newPrice = t.currentPrice * (1 + percentChange);
        
        // Calculate floating P&L
        let pnl = 0;
        const diff = newPrice - t.entryPrice;
        if (t.direction === "BUY") {
          pnl = diff * t.unitSize;
        } else {
          pnl = -diff * t.unitSize;
        }

        // Logic check for targets (TP / SL) hit
        let status: SimulatedTrade["status"] = t.status;
        let finalPnl = pnl;
        let closed = false;

        // Check Stop Loss
        if (t.direction === "BUY" && newPrice <= t.stopLoss) {
          status = "SL";
          finalPnl = (t.stopLoss - t.entryPrice) * t.unitSize;
          closed = true;
        } else if (t.direction === "SELL" && newPrice >= t.stopLoss) {
          status = "SL";
          finalPnl = -(t.stopLoss - t.entryPrice) * t.unitSize;
          closed = true;
        }
        // Check Take Profits
        else if (t.direction === "BUY") {
          if (newPrice >= t.takeProfit3 && t.status !== "TP3") {
            status = "TP3";
            finalPnl = (t.takeProfit3 - t.entryPrice) * t.unitSize;
            closed = true;
          } else if (newPrice >= t.takeProfit2 && t.status !== "TP2" && t.status !== "TP3") {
            status = "TP2";
            finalPnl = (t.takeProfit2 - t.entryPrice) * t.unitSize;
          } else if (newPrice >= t.takeProfit1 && t.status === "OPEN") {
            status = "TP1";
            finalPnl = (t.takeProfit1 - t.entryPrice) * t.unitSize;
          }
        } else { // SELL
          if (newPrice <= t.takeProfit3 && t.status !== "TP3") {
            status = "TP3";
            finalPnl = -(t.takeProfit3 - t.entryPrice) * t.unitSize;
            closed = true;
          } else if (newPrice <= t.takeProfit2 && t.status !== "TP2" && t.status !== "TP3") {
            status = "TP2";
            finalPnl = -(t.takeProfit2 - t.entryPrice) * t.unitSize;
          } else if (newPrice <= t.takeProfit1 && t.status === "OPEN") {
            status = "TP1";
            finalPnl = -(t.takeProfit1 - t.entryPrice) * t.unitSize;
          }
        }

        if (status !== t.status) {
          changed = true;
          // Log it
          const actionText = status === "SL" 
            ? `🚨 [SL Hit] ${t.pair} closed at Stop Loss. P&L: $${finalPnl.toFixed(2)}`
            : `🎯 [TP Target] ${t.pair} hit ${status} at ${newPrice.toFixed(4)}. Floating P&L: $${finalPnl.toFixed(2)}`;
          
          addLog(actionText);

          if (closed) {
            // Apply realized profit to account balance
            setAccount(prev => ({
              ...prev,
              balance: prev.balance + finalPnl,
              pnlHistory: [...prev.pnlHistory, { timestamp: new Date().toISOString(), balance: prev.balance + finalPnl }]
            }));
            return {
              ...t,
              currentPrice: closed ? (status === "SL" ? t.stopLoss : t.takeProfit3) : newPrice,
              status: "CLOSED",
              profitUSD: finalPnl,
              closeTime: new Date().toISOString()
            };
          }
        }

        return {
          ...t,
          currentPrice: newPrice,
          status,
          profitUSD: pnl
        };
      });

      setTrades(updatedTrades);
    }, 4000);

    return () => clearInterval(interval);
  }, [isRunning, trades]);

  // Synchronize new master signals from system automatically
  useEffect(() => {
    if (!isRunning || signals.length === 0) return;

    // Check if we already have an open or active trade for the active signals
    signals.forEach(s => {
      const alreadyTraded = trades.some(t => t.pair === s.pair && (t.status === "OPEN" || t.status.startsWith("TP")));
      if (!alreadyTraded) {
        // Trigger simulated order execution
        executeSimulatedTrade(s);
      }
    });

  }, [isRunning, signals]);

  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 49)]);
  };

  const executeSimulatedTrade = (sig: Signal) => {
    const isBuy = sig.dirEn === "BUY";
    const avgEntry = (sig.entry_low + sig.entry_high) / 2;
    
    // Risk 1.5% of account balance
    const riskPct = 1.5;
    const dollarRisk = account.balance * (riskPct / 100);
    const stopLossDiff = Math.abs(avgEntry - sig.stop_loss);
    
    const unitSize = stopLossDiff > 0 ? dollarRisk / stopLossDiff : 1;

    const newTrade: SimulatedTrade = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      pair: sig.pair,
      direction: isBuy ? "BUY" : "SELL",
      entryPrice: avgEntry,
      currentPrice: avgEntry,
      stopLoss: sig.stop_loss,
      takeProfit1: sig.target1,
      takeProfit2: sig.target2,
      takeProfit3: sig.target3,
      unitSize,
      capitalRiskedPct: riskPct,
      status: "OPEN",
      profitUSD: 0,
      openTime: new Date().toISOString()
    };

    setTrades(prev => [newTrade, ...prev]);
    addLog(`🤖 robot: Executed Sim-${isBuy ? 'BUY' : 'SELL'} market order for ${sig.pair} at ${avgEntry.toFixed(4)} Units: ${unitSize.toFixed(2)}`);
  };

  // Allow manual simulation trigger to show the bot in action!
  const triggerManualSimulation = () => {
    // Generate a random high confidence signal to trade
    const randomPairs = ["XAU/USD", "BTC/USD", "EUR/USD", "GBP/USD", "SOL/USD"];
    const pair = randomPairs[Math.floor(Math.random() * randomPairs.length)];
    const price = pair === "BTC/USD" ? 64000 : pair === "SOL/USD" ? 145 : pair === "XAU/USD" ? 2320 : 1.0850;
    const direction = Math.random() > 0.5 ? "BUY" : "SELL";
    
    const isBuy = direction === "BUY";
    const percentDist = 0.015; // 1.5% 
    
    const target1 = isBuy ? price * (1 + percentDist * 0.5) : price * (1 - percentDist * 0.5);
    const target2 = isBuy ? price * (1 + percentDist) : price * (1 - percentDist);
    const target3 = isBuy ? price * (1 + percentDist * 1.5) : price * (1 - percentDist * 1.5);
    const stop_loss = isBuy ? price * (1 - percentDist * 0.7) : price * (1 + percentDist * 0.7);

    const mockSignal: Signal = {
      pair,
      dirEn: direction as "BUY" | "SELL",
      entry_low: price * 0.999,
      entry_high: price * 1.001,
      target1,
      target2,
      target3,
      stop_loss,
      rr: "1:2.8",
      confidence: "high",
      trade_type: "clean",
      risk_level: "medium",
      reason: "Simulated structural break validation from custom parameters.",
      estimatedDurationEn: "4 hours",
      estimatedDurationAr: "٤ ساعات",
      exitStrategyEn: "Close 50% at Target 1, trail stop to entry.",
      exitStrategyAr: "إغلاق نصف العقود عند الهدف الأول وتأمين الصفقة.",
      score: 87
    };

    executeSimulatedTrade(mockSignal);
  };

  const handleResetSimulator = () => {
    if (window.confirm(isAr ? "هل تريد إعادة تعيين حساب ونتائج المحاكاة لـ $10,000؟" : "Reset simulator cash and logs to $10,000?")) {
      setAccount({
        balance: 10000,
        initialBalance: 10000,
        pnlHistory: [{ timestamp: new Date().toISOString(), balance: 10000 }]
      });
      setTrades([]);
      setLogs([
        isAr 
          ? "🔄 تم تصفير بيانات محاكاة الصفقات والبدء من جديد." 
          : "🔄 Simulation metrics and logs successfully reset."
      ]);
    }
  };

  const floatingPnlSum = trades
    .filter(t => t.status === "OPEN" || t.status.startsWith("TP"))
    .reduce((sum, t) => sum + t.profitUSD, 0);

  const totalClosedPnl = trades
    .filter(t => t.status === "CLOSED")
    .reduce((sum, t) => sum + t.profitUSD, 0);

  const totalWinCount = trades.filter(t => t.status === "CLOSED" && t.profitUSD > 0).length;
  const totalLossCount = trades.filter(t => t.status === "CLOSED" && t.profitUSD <= 0).length;
  const totalCount = totalWinCount + totalLossCount;
  const winRate = totalCount > 0 ? (totalWinCount / totalCount) * 100 : 0;

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-emerald-500/40">
      
      {/* Glow */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-600/5 blur-3xl pointer-events-none rounded-full"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {isAr ? "روبوت محاكاة الصفقات الآلي للنخبة" : "Elite Auto-Trade Bot Simulator"}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
              {isAr ? "تنفيذ تداولات آلية من الحساب التجريبي وقياس العوائد الفورية" : "Simulate automated execution of active signals on virtual assets"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Toggle Engine */}
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex-1 sm:flex-none border px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
              isRunning 
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 animate-pulse" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3 h-3 text-rose-500 fill-rose-500" />
                <span>{isAr ? "إيقاف الروبوت" : "STOP ROBOT"}</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                <span>{isAr ? "تشغيل الروبوت" : "RUN ROBOT"}</span>
              </>
            )}
          </button>

          <button
            onClick={handleResetSimulator}
            className="p-1.5 px-3 border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-[10px] text-slate-400 rounded-xl cursor-pointer"
            title="Reset simulation account"
          >
            {isAr ? "صفر الحساب" : "Reset Account"}
          </button>
        </div>
      </div>

      {/* Account stats panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{isAr ? "رصيد المحفظة الكلي" : "Total Cash Balance"}</span>
            <span className="text-lg font-black text-white font-mono mt-1 block">
              ${(account.balance + floatingPnlSum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{isAr ? "الربح العائم / المحقق" : "Active / Closed P&L"}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-sm font-bold font-mono ${floatingPnlSum >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {floatingPnlSum >= 0 ? "+" : ""}${floatingPnlSum.toFixed(2)}
              </span>
              <span className="text-slate-500 text-xs text-center font-mono">/</span>
              <span className={`text-sm font-bold font-mono ${totalClosedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalClosedPnl >= 0 ? "+" : ""}${totalClosedPnl.toFixed(1)}
              </span>
            </div>
          </div>
          <div className={`p-2.5 rounded-xl ${totalClosedPnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
            {totalClosedPnl >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{isAr ? "نسبة نجاح الصفقات المغلقة" : "Simulated Win-Rate"}</span>
            <span className="text-lg font-black text-teal-400 font-mono mt-1 block">
              {winRate.toFixed(1)}% <span className="text-[10px] text-slate-500 font-normal">({totalCount} {isAr ? "تداولات" : "trades"})</span>
            </span>
          </div>
          <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Simulator quick tester triggers */}
      {isRunning && (
        <div className="mb-6 p-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-200">
              {isAr ? "⚡ جرب محاكاة تداول النخبة فورا" : "⚡ Trigger Instant Trade Simulation"}
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
              {isAr 
                ? "اضغط لبدء صفقة فورية عشوائية والتحقق من آلية مطابقة وقف الخسارة والأرباح تلقائيا." 
                : "Inject an instant randomized live signal trade to verify how our autopilot sizer works."}
            </p>
          </div>
          <button
            onClick={triggerManualSimulation}
            className="p-2 px-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-black text-indigo-300 hover:text-white transition cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-1"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isAr ? "افتح صفقة محاكاة" : "Simulate Signal Trade"}</span>
          </button>
        </div>
      )}

      {/* Active Position Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Trades Ledger */}
        <div className="bg-black/30 border border-slate-900 rounded-2xl p-4 flex flex-col h-80">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2 shrink-0">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? "محفظة تداولات الروبوت النشطة" : "Active Robot Positions Ledger"}</span>
          </h4>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 italic text-[11px] text-center p-3">
                <span>{isAr ? "لا توجد مراكز تداول مفتوحة حاليا." : "No trades active in ledger yet."}</span>
                <span className="text-[9px] mt-1 text-slate-700">{isAr ? "تأكد من تشغيل الروبوت لفتح الصفقات تلقائيا عند هبوط إشارات جديدة" : "Turn on simulator to open positions automatically."}</span>
              </div>
            ) : (
              trades.map((t) => {
                const isBuy = t.direction === "BUY";
                const isClosed = t.status === "CLOSED";
                const pnl = t.profitUSD;
                
                return (
                  <div key={t.id} className={`p-3 rounded-xl border transition text-xs leading-normal font-mono ${
                    isClosed 
                      ? "bg-slate-950/40 border-slate-900 opacity-60" 
                      : "bg-slate-900/60 border-slate-850 hover:border-slate-750"
                  }`}>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-slate-500' : isBuy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></span>
                        <span>{t.pair}</span>
                        <span className={`text-[9.5px] px-1 py-0.2 rounded font-bold uppercase ${
                          isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {t.direction}
                        </span>
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isClosed ? "bg-slate-900 text-slate-500" : t.status.startsWith("TP") ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1.5 text-[9.5px] text-slate-400 mt-2 py-1 leading-none">
                      <div className="flex justify-between p-0.5">
                        <span>{isAr ? "سعر الدخول:" : "Entry:"}</span>
                        <span className="text-white font-bold">{t.entryPrice.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between p-0.5">
                        <span>{isAr ? "السعر الحالي:" : "Current:"}</span>
                        <span className="text-indigo-305 font-bold text-indigo-300">{t.currentPrice.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between p-0.5 border-t border-white/5 pt-1.5">
                        <span>{isAr ? "العقود (الكمية):" : "Units:"}</span>
                        <span className="text-slate-300">{t.unitSize.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-0.5 border-t border-white/5 pt-1.5">
                        <span>{isAr ? "الربح/الخسارة:" : "P&L USD:"}</span>
                        <span className={`font-black ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Logs console */}
        <div className="bg-black/40 border border-slate-900 rounded-2xl p-4 flex flex-col h-80 font-mono">
          <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-550 bg-indigo-500 animate-ping"></span>
            <span>{isAr ? "وحدة تحكم ومراقبة المحرك الآلي" : "Robot Engine Command Logs"}</span>
          </h4>

          <div className="flex-1 bg-black/80 border border-slate-900 rounded-xl p-3 overflow-y-auto space-y-1.5 pr-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`border-l-2 pl-2 ${
                  log.includes("🚨") || log.includes("closed") || log.includes("SL")
                    ? "border-rose-500/60 text-slate-400" 
                    : log.includes("🎯") || log.includes("TP") 
                      ? "border-indigo-500/60 text-slate-300"
                      : log.includes("Executed")
                        ? "border-emerald-500/60 text-emerald-400/90"
                        : "border-slate-800 text-slate-500"
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
