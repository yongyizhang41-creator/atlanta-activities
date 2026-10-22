"use client";
import { MapPin, ArrowUpRight, Plus, Check, Clock3 } from "lucide-react";
import type { Activity, Plan } from "@/lib/types";
import { clock, day } from "@/lib/time";
export default function EventCard({
  event,
  onOpen,
  onAdd,
  plan,
  compact = false,
}: {
  event: Activity;
  onOpen: () => void;
  onAdd?: (status: "maybe" | "going") => void;
  plan?: Plan;
  compact?: boolean;
}) {
  const start = new Date(event.starts_at),
    end = event.ends_at ? new Date(event.ends_at) : null;
  const past = (end || start).getTime() <= Date.now();
  const ongoing = !past && start.getTime() < Date.now() && !!end;
  const stale =
    Date.now() - new Date(event.last_verified_at).getTime() > 86400000;
  return (
    <article className={`event-card ${compact ? "compact" : ""}`}>
      <div className="card-top">
        <span
          className={`category category-${event.categories[0]?.toLowerCase().replaceAll(" ", "-")}`}
        >
          {event.categories[0] || "Community"}
        </span>
        <span className="card-day">{day(event.starts_at)}</span>
      </div>
      <button className="event-title" onClick={onOpen}>
        <h3>{event.title}</h3>
        <ArrowUpRight size={18} />
      </button>
      <div className="card-facts">
        <span>
          <Clock3 size={14} />
          {clock(event.starts_at)}
          {event.ends_at ? " – " + clock(event.ends_at) : " · End time unknown"}
        </span>
        <span>
          <MapPin size={14} />
          {event.venue}
        </span>
      </div>
      <div className="card-labels">
        {event.status === "cancelled" ? (
          <span className="badge danger">Cancelled</span>
        ) : past ? (
          <span className="badge">Ended</span>
        ) : ongoing ? (
          <span className="badge live">In progress</span>
        ) : null}
        {stale && <span className="badge warning">Check latest details</span>}
        <span className="eligibility">{event.eligibility}</span>
      </div>
      {!compact && (
        <p className="card-excerpt">
          {event.description || "See the event source for the latest details."}
        </p>
      )}
      {onAdd && (
        <div className="card-actions">
          {plan ? (
            <span className="saved">
              <Check size={15} />
              In {plan.status === "going" ? "Going" : "Maybe"}
            </span>
          ) : (
            <>
              <button className="small" onClick={() => onAdd("maybe")}>
                <Plus size={14} />
                Maybe
              </button>
              <button
                className="small primary"
                disabled={past || event.status === "cancelled"}
                onClick={() => onAdd("going")}
              >
                I’m going <ArrowUpRight size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
