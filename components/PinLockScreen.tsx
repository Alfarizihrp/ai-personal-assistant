"use client";

import { Delete, Loader2, ShieldCheck, Sparkles } from "lucide-react";

interface PinLockScreenProps {
  pinInput: string;
  pinError: string;
  verifyingPin: boolean;
  enteringDemo: boolean;
  onPinDigit: (digit: string) => void;
  onPinBackspace: () => void;
  onEnterGuestDemo: () => void;
}

export default function PinLockScreen({
  pinInput,
  pinError,
  verifyingPin,
  enteringDemo,
  onPinDigit,
  onPinBackspace,
  onEnterGuestDemo,
}: PinLockScreenProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
      <div className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-950/70 border border-blue-800/60 flex items-center justify-center mb-4">
          {verifyingPin ? (
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          ) : (
            <ShieldCheck className="w-7 h-7 text-blue-400" />
          )}
        </div>

        <h1 className="text-lg font-bold tracking-tight">Akses Pribadi Akhi</h1>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          Masukkan 6 digit PIN untuk membuka asisten
        </p>

        <div className="flex items-center justify-center gap-3 mb-5">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = idx < pinInput.length;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? "bg-blue-500 scale-110 shadow-sm shadow-blue-500/50"
                    : "bg-slate-800 border border-slate-700"
                }`}
              />
            );
          })}
        </div>

        {pinError && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-900/60 px-3 py-1.5 rounded-lg mb-4 w-full">
            {pinError}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2.5 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={verifyingPin}
              onClick={() => onPinDigit(num)}
              className="h-14 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800/90 text-lg font-semibold text-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          <div className="h-14" />

          <button
            type="button"
            disabled={verifyingPin}
            onClick={() => onPinDigit("0")}
            className="h-14 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800/90 text-lg font-semibold text-slate-100 transition cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            disabled={verifyingPin || pinInput.length === 0}
            onClick={onPinBackspace}
            className="h-14 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800/90 flex items-center justify-center text-slate-400 hover:text-red-400 transition cursor-pointer disabled:opacity-40"
            title="Hapus digit"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            disabled={enteringDemo || verifyingPin}
            onClick={onEnterGuestDemo}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/70 border border-blue-800/60 text-blue-300 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {enteringDemo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyiapkan Sandbox Demo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Mode Demo Tamu (Recruiter Sandbox)</span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-slate-600 mt-6">
          AI Personal Assistant • Built by Alfarizi
        </p>
      </div>
    </main>
  );
}
