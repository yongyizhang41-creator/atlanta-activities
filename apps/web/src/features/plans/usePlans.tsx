"use client";
import { useState } from "react";
import { api, ApiError, send } from "@/lib/api";
import type { Activity, Plan, Conflict } from "@/lib/types";
import { Modal, Notice } from "@/components/ui";
import { fullTime } from "@/lib/time";
type Challenge = {
  event: Activity;
  version?: number;
  token: string;
  conflicts: Conflict[];
  unknown_end_events: { id: string; title: string }[];
};
export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [challenge, setChallenge] = useState<Challenge | null>(null);
  const reload = async () => {
    const d = await api<{ items: Plan[] }>("/me/plans");
    setPlans(d.items);
  };
  async function move(
    event: Activity,
    status: "maybe" | "going",
    token?: string,
  ) {
    setBusy(true);
    setError("");
    const p = plans.find((p) => p.event_id === event.id);
    try {
      await api(
        "/me/plans/" + event.id,
        send("PUT", {
          status,
          expected_version: p?.version,
          confirmation_token: token,
        }),
      );
      setChallenge(null);
      await reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === "schedule_conflict")
        setChallenge({ event, version: p?.version, ...e.details } as Challenge);
      else {
        setError((e as Error).message);
        await reload().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("/me/plans/" + id, send("DELETE"));
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const conflictDialog = challenge && (
    <Modal
      title="Two good plans. One time slot."
      description="Review the overlap before adding this activity to Going."
      onClose={() => {
        if (!busy) setChallenge(null);
      }}
    >
      <div className="conflict-list">
        <h3>{challenge.event.title}</h3>
        <p>{fullTime(challenge.event.starts_at)}</p>
        {challenge.conflicts.map((c) => (
          <div className="conflict-item" key={c.event_id}>
            <strong>{c.title}</strong>
            <p>{fullTime(c.starts_at)}</p>
            <small>
              Overlap: {fullTime(c.overlap_start)} – {fullTime(c.overlap_end)}
            </small>
          </div>
        ))}
        {challenge.unknown_end_events.length > 0 && (
          <Notice>
            Cannot fully check conflicts:{" "}
            {challenge.unknown_end_events.map((e) => e.title).join(", ")} has no
            confirmed end time.
          </Notice>
        )}
      </div>
      <p className="muted">
        You can keep both if you plan to attend only part of an activity. Travel
        time is not included.
      </p>
      <div className="dialog-actions">
        <button disabled={busy} onClick={() => move(challenge.event, "maybe")}>
          Keep in Maybe
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => move(challenge.event, "going", challenge.token)}
        >
          Add anyway
        </button>
      </div>
    </Modal>
  );
  return { plans, reload, move, remove, error, setError, busy, conflictDialog };
}
