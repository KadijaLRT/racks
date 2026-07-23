"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Download, Upload, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { exportAllData, importAllData } from "@/lib/storage";
import { keys, del } from "idb-keyval";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().slice(0, 10);
      link.download = `racks-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage("Backup downloaded.");
    } catch {
      setError("Couldn't create a backup file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { restored, failed } = await importAllData(parsed);
      if (restored.length === 0) {
        throw new Error("That file didn't contain any recognizable Racks data.");
      }
      setMessage(
        `Restored: ${restored.join(", ")}.${
          failed.length ? ` Couldn't restore: ${failed.join(", ")}.` : ""
        } Reload the app to see everything.`
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("JSON")
          ? "That file isn't a valid Racks backup."
          : err instanceof Error
          ? err.message
          : "Couldn't import that file."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setBusy(true);
    setError("");
    try {
      const allKeys = (await keys()) || [];
      await Promise.all(allKeys.map((k) => del(k)));
      setMessage("All local data cleared. Reload the app to start fresh.");
      setConfirmingClear(false);
    } catch {
      setError("Couldn't clear data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/profile" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Settings</h1>
        </div>

        {message ? (
          <div className="rounded-xl bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-stone-700">Your data</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Everything in Racks lives only on this device. Back it up
              before clearing your browser data or switching devices.
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 text-cream py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download backup
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full rounded-xl border border-clay-200 text-stone-600 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Restore from backup
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-clay-700">Clear all data</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Permanently deletes your closet, looks, wishlist, and every
              profile on this device. This cannot be undone, download a
              backup first if you&apos;re not sure.
            </p>
          </div>

          {confirmingClear ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingClear(false)}
                className="flex-1 rounded-xl border border-clay-200 py-2 text-xs text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={busy}
                className="flex-1 rounded-xl bg-clay-700 text-cream py-2 text-xs font-medium disabled:opacity-60"
              >
                {busy ? "Clearing..." : "Confirm, delete everything"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              className="w-full rounded-xl border border-clay-200 text-clay-700 py-2.5 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Clear all data
            </button>
          )}
        </div>

        <p className="text-xs text-stone-400 text-center">Racks · v0.1.0</p>
      </div>

      <BottomNav />
    </main>
  );
}
