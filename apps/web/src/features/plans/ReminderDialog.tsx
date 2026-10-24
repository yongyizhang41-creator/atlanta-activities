"use client";
import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { Modal, Field, Notice } from "@/components/ui";
import { api, send } from "@/lib/api";
import { fullTime, resolveLocalTime, zone } from "@/lib/time";
import { useAuth } from "@/components/shell";
import type { Plan, Reminder } from "@/lib/types";
export default function ReminderDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>(plan.reminders || []);
  const currentReminders = reminders.filter(
    (r) => r.status !== "sent" && r.status !== "cancelled",
  );
  const [editing, setEditing] = useState<string | null>(null);
  const base = "/me/plans/" + plan.event_id + "/reminders";
  async function refresh() {
    setReminders(await api<Reminder[]>(base));
    await onSaved();
  }
  function edit(reminder: Reminder) {
    setEditing(reminder.id);
    setSelection("custom");
    const date = DateTime.fromISO(reminder.remind_at).setZone(zone);
    const localTime = date.toFormat("yyyy-MM-dd'T'HH:mm");
    setLocal(localTime);
    setOffset(
      resolveLocalTime(localTime).find(
        (c) => DateTime.fromISO(c.iso).setZone(zone).offset === date.offset,
      )?.iso || "",
    );
    setError("");
  }
  const [selection, setSelection] = useState("60"),
    [local, setLocal] = useState(""),
    [offset, setOffset] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const choices = useMemo(
    () => (local ? resolveLocalTime(local) : []),
    [local],
  );
  const start = new Date(plan.event.starts_at).getTime(),
    now = Date.now();
  async function save() {
    setError("");
    let value = "";
    if (selection === "custom") {
      if (!choices.length) {
        setError(
          "Choose a valid Eastern time. This local time may not exist because of daylight saving.",
        );
        return;
      }
      value = choices.length === 1 ? choices[0].iso : offset;
      if (!value) {
        setError("This local time occurs twice. Select the timezone offset.");
        return;
      }
    } else value = new Date(start - Number(selection) * 60000).toISOString();
    if (!(
      Date.now() < new Date(value).getTime() &&
      new Date(value).getTime() < start
    )) {
      setError("Choose a future reminder before the event starts.");
      return;
    }
    setBusy(true);
    try {
      await api(
        "/me/plans/" + plan.event_id + "/reminder",
        send("PUT", { remind_at: value }),
      );
      setEditing(null);
      setSelection("60");
      setLocal("");
      setOffset("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    setBusy(true);
    try {
      await api(base + "/" + id, send("DELETE"));
      if (editing === id) setEditing(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="A little nudge before you go."
      description={plan.event.title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Starts <strong>{fullTime(plan.event.starts_at)}</strong>
      </p>
      <p className="muted">
        Each scheduled reminder sends one email to <strong>{user.email}</strong>
        .
      </p>
      <p className="muted">
        One upcoming reminder per activity. Saving a new time replaces the
        previous reminder. Your email sends only at the latest saved time.
      </p>
      {currentReminders.length > 0 && (
        <ul className="reminder-list" aria-label="Scheduled reminders">
          {currentReminders.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{fullTime(r.remind_at)}</strong>
                <span className="muted">{r.status.replaceAll("_", " ")}</span>
                {r.error && <p className="muted">{r.error}</p>}
              </div>
              {r.editable && (
                <div className="reminder-row-actions">
                  <button
                    className="small"
                    disabled={busy}
                    onClick={() => edit(r)}
                    aria-label={"Edit reminder at " + fullTime(r.remind_at)}
                  >
                    Edit
                  </button>
                  <button
                    className="small"
                    disabled={busy}
                    onClick={() => cancel(r.id)}
                    aria-label={"Cancel reminder at " + fullTime(r.remind_at)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!user.verified && (
        <Notice error>
          Verify your email in Account settings to enable reminders.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {
        <>
          <fieldset className="reminder-options">
            <legend>
              {editing
                ? "Edit reminder time"
                : "Choose a reminder before it starts"}
            </legend>
            {[
              ["1440", "1 day"],
              ["180", "3 hours"],
              ["60", "1 hour"],
              ["30", "30 minutes"],
              ["custom", "Choose a time"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="reminder"
                  value={value}
                  checked={selection === value}
                  disabled={
                    value !== "custom" && start - Number(value) * 60000 <= now
                  }
                  onChange={() => setSelection(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {selection === "custom" && (
            <>
              <Field id="reminder-local" label="Reminder time · Eastern">
                <input
                  id="reminder-local"
                  type="datetime-local"
                  value={local}
                  min={DateTime.now()
                    .setZone(zone)
                    .toFormat("yyyy-MM-dd'T'HH:mm")}
                  max={DateTime.fromISO(plan.event.starts_at)
                    .setZone(zone)
                    .toFormat("yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => {
                    setLocal(e.target.value);
                    setOffset("");
                  }}
                />
              </Field>
              {choices.length > 1 && (
                <Field id="offset" label="This time occurs twice. Choose one.">
                  <select
                    id="offset"
                    value={offset}
                    onChange={(e) => setOffset(e.target.value)}
                  >
                    <option value="">Choose timezone offset</option>
                    {choices.map((c) => (
                      <option value={c.iso} key={c.iso}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}
          <div className="dialog-actions">
            {editing && (
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setSelection("60");
                  setError("");
                }}
              >
                Stop editing
              </button>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                !user.verified ||
                start <= now ||
                (selection !== "custom" &&
                  start - Number(selection) * 60000 <= now)
              }
              onClick={save}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Save reminder"}
            </button>
          </div>
        </>
      }
      <p className="muted">
        Emails already sent or submitted cannot be recalled. Past and cancelled
        reminders are hidden here.
      </p>
    </Modal>
  );
}
