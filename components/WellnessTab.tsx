"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Dumbbell,
  Flame,
  CheckCircle2,
  Loader2,
  Sparkles,
  Plus,
} from "lucide-react";
import { compressImageToBase64 } from "@/lib/image-compress";

interface NutritionEntry {
  id: number;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ai_notes?: string;
  created_at: string;
}

interface WorkoutEntry {
  id: number;
  routine_name: string;
  duration_minutes: number;
  ai_plan?: string;
  ai_evaluation?: string | null;
  is_completed: boolean;
  created_at: string;
}

export default function WellnessTab() {
  const [nutrition, setNutrition] = useState<NutritionEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [scanningMeal, setScanningMeal] = useState(false);
  const [workoutGoal, setWorkoutGoal] = useState("");
  const [generatingWorkout, setGeneratingWorkout] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchWellnessData = async () => {
    try {
      const res = await fetch("/api/wellness");
      const data = await res.json();
      if (res.ok) {
        setNutrition(data.nutrition || []);
        setWorkouts(data.workouts || []);
      }
    } catch {
      // Abaikan jika gagal memuat awal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWellnessData();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningMeal(true);
    setErrorMsg("");

    try {
      const { base64, mimeType } = await compressImageToBase64(file, 512, 0.72);
      const res = await fetch("/api/wellness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_meal",
          imageBase64: base64,
          mimeType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menganalisis foto.");

      setNutrition((prev) => [data.entry, ...prev]);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setScanningMeal(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutGoal.trim() || generatingWorkout) return;

    setGeneratingWorkout(true);
    setErrorMsg("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Maksimal tunggu 20 detik

    try {
      const res = await fetch("/api/wellness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          action: "generate_workout",
          goal: workoutGoal.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat skema latihan.");

      setWorkouts((prev) => [data.workout, ...prev]);
      setWorkoutGoal("");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setErrorMsg("Waktu tunggu habis (20 detik). Silakan tekan Buat Skema lagi.");
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      clearTimeout(timeoutId);
      setGeneratingWorkout(false);
    }
  };

  const handleCompleteWorkout = async (item: WorkoutEntry) => {
    if (item.is_completed || completingId === item.id) return;
    setCompletingId(item.id);

    try {
      const res = await fetch("/api/wellness", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          routine_name: item.routine_name,
          duration_minutes: item.duration_minutes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyelesaikan latihan.");

      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === item.id
            ? { ...w, is_completed: true, ai_evaluation: data.ai_evaluation }
            : w
        )
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setCompletingId(null);
    }
  };

  // Hitung total kalori & protein dari log terbaru
  const totalCalories = nutrition.reduce((acc, item) => acc + Number(item.calories || 0), 0);
  const totalProtein = nutrition.reduce((acc, item) => acc + Number(item.protein_g || 0), 0);
  const calorieTarget = 2000;
  const caloriePct = Math.min(100, Math.round((totalCalories / calorieTarget) * 100));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Memuat data nutrisi & latihan...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-rose-950/70 border border-rose-800 text-rose-200 text-xs px-3 py-2 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* BAGIAN 1: AI CALORIE SCANNER (ZERO-BLOB) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              AI Calorie & Macro Scanner
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {totalCalories} / {calorieTarget} kkal
          </span>
        </div>

        {/* Progress Bar Kalori */}
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-emerald-500 to-orange-400 h-full transition-all duration-500"
            style={{ width: `${caloriePct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Total Protein Tercatat: <strong className="text-emerald-400">{totalProtein.toFixed(1)}g</strong></span>
          <span>Kompresi Otomatis &lt;70KB</span>
        </div>

        {/* Tombol Unggah / Foto Makanan */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <button
          type="button"
          disabled={scanningMeal}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
        >
          {scanningMeal ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Menganalisis Nutrisi Foto Makanan...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Foto / Unggah Makanan untuk Hitung Kalori</span>
            </>
          )}
        </button>

        {/* Daftar Riwayat Makanan */}
        <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
          {nutrition.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">
              Belum ada log makanan. Unggah foto makanan untuk mulai menghitung.
            </p>
          ) : (
            nutrition.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-100">{item.food_name}</p>
                  <span className="text-xs font-bold text-orange-400 shrink-0">
                    {item.calories} kkal
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] text-slate-400">
                  <span>Protein: {item.protein_g}g</span>
                  <span>Karbo: {item.carbs_g}g</span>
                  <span>Lemak: {item.fat_g}g</span>
                </div>
                {item.ai_notes && (
                  <p className="text-[11px] text-slate-400 italic pt-0.5">
                    &ldquo;{item.ai_notes}&rdquo;
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* BAGIAN 2: AI WORKOUT PLAN & MONITOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            Skema Olahraga Terpantau AI
          </h2>
        </div>

        <form onSubmit={handleGenerateWorkout} className="flex gap-2">
          <input
            type="text"
            value={workoutGoal}
            onChange={(e) => setWorkoutGoal(e.target.value)}
            placeholder="Target latihan (mis: Cardio 25 mnt / Upper body)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={generatingWorkout || !workoutGoal.trim()}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            {generatingWorkout ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Buat Skema</span>
          </button>
        </form>

        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-100">
                    {w.routine_name}
                  </h3>
                  <span className="text-[10px] text-blue-400">
                    Durasi Target: {w.duration_minutes} menit
                  </span>
                </div>

                {w.is_completed ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Selesai
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={completingId === w.id}
                    onClick={() => handleCompleteWorkout(w)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white transition cursor-pointer shrink-0"
                  >
                    {completingId === w.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    )}
                    <span>Selesai & Evaluasi</span>
                  </button>
                )}
              </div>

              {w.ai_plan && (
                <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/70 p-2 rounded-lg border border-slate-800/60">
                  {w.ai_plan}
                </p>
              )}

              {w.ai_evaluation && (
                <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 p-2 rounded-lg">
                  <strong>Evaluasi Coach AI:</strong> {w.ai_evaluation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}