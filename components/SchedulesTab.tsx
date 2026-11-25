"use client";

import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { ScheduleItem } from "@/types/assistant";
import SheetsExportControl from "@/components/SheetsExportControl";

interface SchedulesTabProps {
  schedules: ScheduleItem[];
  loadingData: boolean;
  pushSubscribed: boolean;
  subscribingPush: boolean;
  testingPush: boolean;
  editingScheduleId: number | null;
  editScheduleTitle: string;
  editScheduleTime: string;
  editScheduleTargetDateTime: string;
  savingEditSchedule: boolean;
  onEnablePush: () => void;
  onTestPush: () => void;
  onToggleDone: (id: number, currentStatus: boolean) => void;
  onStartEdit: (item: ScheduleItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onEditTitleChange: (val: string) => void;
  onEditTimeChange: (val: string) => void;
  onEditTargetDateTimeChange: (val: string) => void;
}

export default function SchedulesTab({
  schedules,
  loadingData,
  pushSubscribed,
  subscribingPush,
  testingPush,
  editingScheduleId,
  editScheduleTitle,
  editScheduleTime,
  editScheduleTargetDateTime,
  savingEditSchedule,
  onEnablePush,
  onTestPush,
  onToggleDone,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditTitleChange,
  onEditTimeChange,
  onEditTargetDateTimeChange,
}: SchedulesTabProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <span>Agenda & Pengingat</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <SheetsExportControl exportType="schedules" />

          {pushSubscribed ? (
            <button
              type="button"
              disabled={testingPush}
              onClick={onTestPush}
              className="text-[11px] bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              {testingPush ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <BellRing className="w-3 h-3" />
              )}
              <span>{testingPush ? "Mengirim..." : "Test Push HP"}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={subscribingPush}
              onClick={onEnablePush}
              className="text-[11px] bg-amber-950/70 hover:bg-amber-900/70 border border-amber-800/60 text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3 h-3" />
              <span>Aktifkan Push</span>
            </button>
          )}
        </div>
      </div>

      {loadingData ? (
        <p className="text-xs text-slate-500 text-center py-4">Memuat agenda...</p>
      ) : schedules.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">
          Belum ada jadwal. Coba ucapkan &ldquo;Ingatkan kajian besok jam 8 malam&rdquo;.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {schedules.map((item) => {
            const isEditingThis = editingScheduleId === item.id;

            return (
              <li
                key={item.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3"
              >
                {isEditingThis ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editScheduleTitle}
                      onChange={(e) => onEditTitleChange(e.target.value)}
                      placeholder="Nama agenda..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={editScheduleTime}
                      onChange={(e) => onEditTimeChange(e.target.value)}
                      placeholder="Waktu agenda (misal: Besok jam 08.00 WIB)..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-400 shrink-0">
                        Pengingat H-15m:
                      </label>
                      <input
                        type="datetime-local"
                        value={editScheduleTargetDateTime}
                        onChange={(e) => onEditTargetDateTimeChange(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="text-[11px] text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Batal</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingEditSchedule || !editScheduleTitle.trim()}
                        onClick={() => onSaveEdit(item.id)}
                        className="text-[11px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-3 py-1 rounded flex items-center gap-1 cursor-pointer"
                      >
                        {savingEditSchedule ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>Simpan</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleDone(item.id, item.is_done)}
                      className="flex items-start gap-3 text-left flex-1 cursor-pointer"
                    >
                      {item.is_done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            item.is_done ? "line-through text-slate-500" : "text-slate-100"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-blue-400 mt-0.5">{item.schedule_time}</p>
                        {item.target_datetime && !item.is_done && (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-900/50">
                            {item.reminded ? "Sudah diingatkan" : "Pengingat aktif (H-15 mnt)"}
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartEdit(item)}
                        className="text-slate-500 hover:text-blue-400 p-1.5 transition cursor-pointer"
                        title="Edit jadwal"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="text-slate-600 hover:text-red-400 p-1.5 transition cursor-pointer"
                        title="Hapus jadwal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
