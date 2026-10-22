"use client";
import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Bell,
  ArrowRight,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
} from "lucide-react";
import { usePlans } from "./usePlans";
import { api, send } from "@/lib/api";
import type { Plan, Activity } from "@/lib/types";
import { Loading, Notice } from "@/components/ui";
import EventCard from "@/features/explore/EventCard";
import EventDetails from "@/features/explore/EventDetails";
import ReminderDialog from "./ReminderDialog";
import { fullTime } from "@/lib/time";
function Card({
  plan,
  onOpen,
  onMove,
  onRemove,
  onReminder,
  busy,
}: {
  plan: Plan;
  onOpen: () => void;
  onMove: () => void;
  onRemove: () => void;
  onReminder: () => void;
  busy: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.event_id, data: { status: plan.status } });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="plan-card"
    >
      <div className="plan-handle">
        <button
          className="icon-button"
          aria-label={"Drag or open " + plan.event.title}
          onClick={onOpen}
          onPointerDown={(event) => listeners?.onPointerDown?.(event)}
          onKeyDown={(event) => listeners?.onKeyDown?.(event)}
          {...attributes}
        >
          <GripVertical size={17} />
        </button>
        <span>{plan.event.categories.join(" · ")}</span>
        <button
          className="icon-button"
          aria-label={"Remove " + plan.event.title}
          disabled={busy}
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <EventCard compact event={plan.event} onOpen={onOpen} />
      {plan.notice && <div className="plan-warning">{plan.notice}</div>}
      {plan.conflicts.length > 0 && (
        <div className="plan-warning">
          <AlertTriangle size={14} />
          <span>
            Overlaps with {plan.conflicts.map((c) => c.title).join(", ")}
          </span>
        </div>
      )}
      {plan.status === "going" && plan.unknown_end_events.length > 0 && (
        <div className="plan-warning">
          Cannot fully check conflicts · end time unknown
        </div>
      )}
      <div className="plan-buttons">
        <button className="small" disabled={busy} onClick={onMove}>
          {plan.status === "going" ? (
            <>
              <ArrowLeft size={13} />
              Maybe
            </>
          ) : (
            <>
              Going
              <ArrowRight size={13} />
            </>
          )}
        </button>
        {plan.status === "going" && (
          <button
            className="small"
            disabled={
              busy ||
              plan.event.status === "cancelled" ||
              new Date(plan.event.starts_at).getTime() <= Date.now()
            }
            onClick={onReminder}
          >
            <Bell size={13} />
            {plan.has_sent_reminder
              ? "Sent"
              : plan.reminder?.status === "pending"
                ? "Edit reminder"
                : "Remind me"}
          </button>
        )}
      </div>
      {plan.reminder?.status === "pending" && (
        <p className="reminder-summary">
          <Bell size={12} />
          {fullTime(plan.reminder.remind_at)}
        </p>
      )}
    </div>
  );
}
function Column({
  status,
  items,
  children,
}: {
  status: "maybe" | "going";
  items: Plan[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={status === "going" ? "Going activities" : "Maybe activities"}
      className={"board-column " + (isOver ? "drag-over" : "")}
    >
      <header>
        <span className={"column-icon " + status}>
          {status === "going" ? (
            <CheckCircle2 size={19} />
          ) : (
            <Bookmark size={19} />
          )}
        </span>
        <div>
          <h2>
            {status === "going" ? "Going" : "Maybe"}
            <span>{items.length}</span>
          </h2>
          <p>
            {status === "going"
              ? "The plans you’re making happen."
              : "Good ideas. No commitment yet."}
          </p>
        </div>
      </header>
      <SortableContext
        items={items.map((p) => p.event_id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
      {!items.length && (
        <div className="column-empty">
          {status === "going"
            ? "Ready to commit? Move an activity here."
            : "Save a few possibilities from Explore."}
        </div>
      )}
      <div className="drop-zone">Drop an activity here</div>
    </section>
  );
}
export default function Board() {
  const board = usePlans();
  const [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<Activity | null>(null),
    [reminder, setReminder] = useState<Plan | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    board
      .reload()
      .catch((e) => board.setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line
  async function dragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || board.busy) return;
    const plan = board.plans.find((p) => p.event_id === active.id);
    if (!plan) return;
    const target =
      over.id === "maybe" || over.id === "going"
        ? over.id
        : board.plans.find((p) => p.event_id === over.id)?.status;
    if (!target) return;
    if (target !== plan.status) {
      await board.move(plan.event, target);
      return;
    }
    if (active.id === over.id) return;
    const items = board.plans.filter((p) => p.status === target);
    const from = items.findIndex((p) => p.event_id === active.id),
      to = items.findIndex((p) => p.event_id === over.id);
    if (from < 0 || to < 0) return;
    try {
      await api(
        "/me/plans/order",
        send("POST", {
          status: target,
          items: arrayMove(items, from, to).map((p) => ({
            event_id: p.event_id,
            version: p.version,
          })),
        }),
      );
      await board.reload();
    } catch (e) {
      board.setError((e as Error).message);
    }
  }
  return (
    <>
      <section className="page-intro">
        <div>
          <span className="eyebrow">YOUR ATLANTA, PLANNED</span>
          <h1>
            A little less maybe.
            <br />
            <em>A little more out.</em>
          </h1>
          <p>
            Drag activities between columns, or use the move buttons. Only Going
            gets reminders.
          </p>
        </div>
        <div className="plan-stats">
          <strong>
            {board.plans.filter((p) => p.status === "going").length}
          </strong>
          <span>
            plans to look
            <br />
            forward to
          </span>
        </div>
      </section>
      {board.error && (
        <Notice error>
          {board.error}
          <button
            className="small"
            onClick={() =>
              board.reload().catch((e) => board.setError(e.message))
            }
          >
            Refresh plans
          </button>
        </Notice>
      )}
      {loading ? (
        <Loading label="Opening your plans…" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={dragEnd}>
          <div className="board">
            {(["maybe", "going"] as const).map((status) => (
              <Column
                key={status}
                status={status}
                items={board.plans.filter((p) => p.status === status)}
              >
                {board.plans
                  .filter((p) => p.status === status)
                  .map((p) => (
                    <Card
                      key={p.event_id}
                      plan={p}
                      busy={board.busy}
                      onOpen={() => setSelected(p.event)}
                      onMove={() =>
                        board.move(
                          p.event,
                          status === "going" ? "maybe" : "going",
                        )
                      }
                      onRemove={() => board.remove(p.event_id)}
                      onReminder={() => setReminder(p)}
                    />
                  ))}
              </Column>
            ))}
          </div>
        </DndContext>
      )}
      {selected && (
        <EventDetails
          event={selected}
          plan={board.plans.find((p) => p.event_id === selected.id)}
          onClose={() => setSelected(null)}
          onAdd={(status) => board.move(selected, status)}
        />
      )}
      {reminder && (
        <ReminderDialog
          plan={reminder}
          onClose={() => setReminder(null)}
          onSaved={board.reload}
        />
      )}
      {board.conflictDialog}
    </>
  );
}
