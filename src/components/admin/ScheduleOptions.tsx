import { Calendar, Zap, Clock } from "lucide-react";

export type ScheduleMode = "immediate" | "interval" | "daily";

interface ScheduleOptionsProps {
  scheduleMode: ScheduleMode;
  setScheduleMode: (mode: ScheduleMode) => void;
  scheduleStart: string;
  setScheduleStart: (val: string) => void;
  intervalHours: number;
  setIntervalHours: (val: number) => void;
}

export default function ScheduleOptions({
  scheduleMode,
  setScheduleMode,
  scheduleStart,
  setScheduleStart,
  intervalHours,
  setIntervalHours,
}: ScheduleOptionsProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Publishing Schedule</label>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setScheduleMode("immediate")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            scheduleMode === "immediate" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Zap size={16} /> Publish Immediately
        </button>
        <button
          onClick={() => setScheduleMode("daily")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            scheduleMode === "daily" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Calendar size={16} /> Publish One Every Day
        </button>
        <button
          onClick={() => setScheduleMode("interval")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            scheduleMode === "interval" ? "bg-amber-500 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Clock size={16} /> Publish One Every X Hours
        </button>
      </div>

      {scheduleMode !== "immediate" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Start Date & Time (Asia/Jakarta, WIB UTC+7)
            </label>
            <input
              type="datetime-local"
              value={scheduleStart}
              onChange={(e) => setScheduleStart(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          {scheduleMode === "interval" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Interval (hours)</label>
              <input
                type="number"
                min={1}
                max={168}
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          )}
        </div>
      )}

      {scheduleMode !== "immediate" && (
        <p className="mt-2 text-xs text-slate-400">
          {scheduleMode === "daily"
            ? "Chapters will be published one per day starting from the selected date/time."
            : `Chapters will be published every ${intervalHours} hour${intervalHours > 1 ? "s" : ""} starting from the selected date/time.`}
        </p>
      )}
      {scheduleMode === "immediate" && (
        <p className="mt-2 text-xs text-slate-400">
          All chapters will be visible to readers immediately upon import.
        </p>
      )}
    </div>
  );
}
