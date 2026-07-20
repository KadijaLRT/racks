"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, CalendarPlus, Loader2 } from "lucide-react";
import { parseIcs } from "@/lib/ics";
import { planStore } from "@/lib/storage";
import type { UpcomingPlan } from "@/lib/types";

export default function UpcomingPlans() {
  const [plans, setPlans] = useState<UpcomingPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addingPlan, setAddingPlan] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanDate, setNewPlanDate] = useState("");
  const [icsImporting, setIcsImporting] = useState(false);
  const [error, setError] = useState("");
  const icsFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    planStore.getAll().then((all) => {
      setPlans(all || []);
      setLoaded(true);
    });
  }, []);

  async function addPlan() {
    const title = newPlanTitle.trim();
    if (!title) return;
    const saved = await planStore.create({
      title,
      date: newPlanDate || undefined,
      prompt: title,
    });
    setPlans((prev) =>
      [...(prev || []), saved].sort((a, b) =>
        a.date && b.date ? a.date.localeCompare(b.date) : 0
      )
    );
    setNewPlanTitle("");
    setNewPlanDate("");
    setAddingPlan(false);
  }

  async function removePlan(plan: UpcomingPlan) {
    await planStore.remove(plan.id);
    setPlans((prev) => (prev || []).filter((p) => p.id !== plan.id));
  }

  async function importIcs(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIcsImporting(true);
    setError("");
    try {
      const text = await file.text();
      const parsed = parseIcs(text) || [];
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = parsed
        .filter((ev) => ev.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 25);

      if (upcoming.length === 0) {
        setError("No upcoming events found in that file.");
        return;
      }

      const saved = await Promise.all(
        upcoming.map((ev) =>
          planStore.create({ title: ev.title, date: ev.date, prompt: ev.title })
        )
      );
      setPlans((prev) =>
        [...(prev || []), ...saved].sort((a, b) =>
          a.date && b.date ? a.date.localeCompare(b.date) : 0
        )
      );
    } catch {
      setError("Couldn't read that file, make sure it's a .ics calendar export.");
    } finally {
      setIcsImporting(false);
    }
  }

  const upcoming = (plans || []).slice(0, 4);

  return (
    <section className="px-4">
      <input
        ref={icsFileRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={importIcs}
      />

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-stone-700">Upcoming plans</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => icsFileRef.current?.click()}
            disabled={icsImporting}
            className="p-1.5 rounded-full text-stone-400 hover:bg-clay-50 disabled:opacity-50"
            aria-label="Import calendar file"
          >
            {icsImporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CalendarPlus size={16} />
            )}
          </button>
          <button
            onClick={() => setAddingPlan((v) => !v)}
            className="p-1.5 rounded-full text-emerald-600 hover:bg-emerald-50"
            aria-label="Add a plan"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-clay-700 mb-2">{error}</p> : null}

      {addingPlan ? (
        <div className="mb-3 flex flex-col md:flex-row gap-2">
          <input
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            placeholder="e.g. Dinner with Sam"
            className="flex-1 rounded-xl border border-clay-100 bg-white px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") addPlan();
            }}
          />
          <input
            type="date"
            value={newPlanDate}
            onChange={(e) => setNewPlanDate(e.target.value)}
            className="rounded-xl border border-clay-100 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={addPlan}
            className="rounded-xl bg-emerald-600 text-cream px-4 py-2 text-sm font-medium"
          >
            Add
          </button>
        </div>
      ) : null}

      {loaded && upcoming.length === 0 ? (
        <p className="text-xs text-stone-400">
          Nothing on the calendar yet. Add a plan to get outfit reminders.
        </p>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between bg-white rounded-xl px-3 py-2"
            >
              <div>
                <p className="text-sm text-stone-700">{plan.title}</p>
                {plan.date ? (
                  <p className="text-xs text-stone-400">{plan.date}</p>
                ) : null}
              </div>
              <button
                onClick={() => removePlan(plan)}
                className="text-stone-300 hover:text-clay-700"
                aria-label={`Remove ${plan.title}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
