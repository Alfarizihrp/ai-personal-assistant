"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  FileSpreadsheet,
  Loader2,
  Settings2,
  X,
} from "lucide-react";
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from "@/lib/sheets";

const STORAGE_KEY = "akhi_sheets_webhook_url";

interface SheetsExportControlProps {
  exportType: "schedules" | "wellness";
  label?: string;
}

export default function SheetsExportControl({
  exportType,
  label = "Kirim ke Sheets",
}: SheetsExportControlProps) {
  const [sending, setSending] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || "";
      if (saved) setWebhookUrl(saved);
    } catch {}

    fetch("/api/export/sheets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.configured) setServerConfigured(true);
      })
      .catch(() => {});
  }, []);

  const handleSaveWebhookUrl = (val: string) => {
    setWebhookUrl(val);
    try {
      if (val.trim()) {
        localStorage.setItem(STORAGE_KEY, val.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {}
  };

  const handleExport = async () => {
    if (sending) return;
    setSending(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/export/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: exportType,
          webhookUrl: webhookUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.needsSetup) {
          setShowSetup(true);
        }
        throw new Error(data.error || "Gagal mengirim data ke Google Sheets.");
      }

      setStatusMessage(data.message || "Berhasil dikirim ke Google Sheets.");
      setShowSetup(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={sending}
          onClick={handleExport}
          className="text-[11px] bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          title="Kirim data langsung ke Google Sheets"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5" />
          )}
          <span>{sending ? "Mengirim..." : label}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSetup(!showSetup)}
          title="Atur URL Google Apps Script Webhook"
          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {statusMessage && (
        <p className="text-[11px] text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-1.5 rounded-lg">
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p className="text-[11px] text-rose-300 bg-rose-950/50 border border-rose-800/60 px-2.5 py-1.5 rounded-lg">
          {errorMessage}
        </p>
      )}

      {showSetup && (
        <div className="bg-slate-950 border border-emerald-800/50 rounded-xl p-3 space-y-2.5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-300">
              Hubungkan Google Sheets (Apps Script Webhook)
            </span>
            <button
              type="button"
              onClick={() => setShowSetup(false)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            {serverConfigured
              ? "Webhook server (GOOGLE_SHEETS_WEBHOOK_URL) sudah aktif. Anda tetap bisa mengisi URL khusus di bawah untuk menimpanya."
              : "1. Buka Google Spreadsheet Anda → Extensions → Apps Script.\n2. Tempel kode di bawah, lalu Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).\n3. Tempel Web App URL-nya di bawah ini:"}
          </p>

          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => handleSaveWebhookUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopyScript}
              className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              {copiedScript ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Script Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Salin Kode Apps Script</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={handleExport}
              className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium cursor-pointer"
            >
              Kirim Sekarang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
