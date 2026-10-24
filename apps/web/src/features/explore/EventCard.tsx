"use client";
import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  cardVariants,
  detailVariants,
  titleVariants,
  actionVariants,
} from "@/components/motion/variants";
import { DateTime } from "luxon";
import { MapPin, ArrowUpRight, Plus, Check, Clock3 } from "lucide-react";
import type { Activity, Plan } from "@/lib/types";
import { clock, planExpiry, zone } from "@/lib/time";
export default function EventCard({
  event,
  onOpen,
  onAdd,
  plan,
  compact = false,
  journal = false,
  onHighlight,
}: {
  event: Activity;
  onOpen: () => void;
  onAdd?: (status: "maybe" | "going") => void;
  plan?: Plan;
  compact?: boolean;
  journal?: boolean;
  onHighlight?: (id: string | null) => void;
}) {
  const reduced = useReducedMotion();
  const article = useRef<HTMLElement>(null);
  const start = new Date(event.starts_at),
    end = event.ends_at ? new Date(event.ends_at) : null;
  const past = planExpiry(event.starts_at, event.ends_at) <= Date.now();
  const ongoing = !past && start.getTime() < Date.now() && !!end;
  const stale =
    Date.now() - new Date(event.last_verified_at).getTime() > 86400000;
  return (
    <motion.article
      ref={article}
      data-activity-id={event.id}
      variants={journal ? cardVariants : undefined}
      initial="rest"
      animate="rest"
      whileHover={journal && !reduced ? "hover" : "rest"}
      onHoverStart={() => onHighlight?.(event.id)}
      onHoverEnd={() => {
        if (!article.current?.contains(document.activeElement))
          onHighlight?.(null);
      }}
      onFocusCapture={() => onHighlight?.(event.id)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          onHighlight?.(null);
      }}
      className={`event-card ${compact ? "compact" : ""} ${journal ? "journal-card" : ""}`}
    >
      <motion.div
        variants={journal && !reduced ? detailVariants : undefined}
        className="card-top"
      >
        <span
          className={`category category-${event.categories[0]?.toLowerCase().replaceAll(" ", "-")}`}
        >
          {event.categories[0] || "Community"}
        </span>
        {journal ? (
          <time
            className="journal-start"
            dateTime={event.starts_at}
            aria-label={DateTime.fromISO(event.starts_at)
              .setZone(zone)
              .setLocale("en-US")
              .toFormat("cccc, LLLL d, h:mm a")}
          >
            {clock(event.starts_at)}
          </time>
        ) : (
          <time
            className="card-date"
            dateTime={event.starts_at}
            aria-label={DateTime.fromISO(event.starts_at)
              .setZone(zone)
              .toFormat("cccc, LLLL d")}
          >
            <span>
              {DateTime.fromISO(event.starts_at).setZone(zone).toFormat("LLL")}
            </span>
            <strong>
              {DateTime.fromISO(event.starts_at).setZone(zone).toFormat("dd")}
            </strong>
            <span>
              {DateTime.fromISO(event.starts_at).setZone(zone).toFormat("ccc")}
            </span>
          </time>
        )}
      </motion.div>
      <motion.button
        variants={journal && !reduced ? titleVariants : undefined}
        whileTap={journal && !reduced ? { scale: 0.985 } : undefined}
        className="event-title"
        onClick={onOpen}
      >
        <h3>{event.title}</h3>
        <ArrowUpRight size={18} />
      </motion.button>
      <motion.div
        variants={journal && !reduced ? detailVariants : undefined}
        className="card-facts"
      >
        <span>
          <Clock3 size={14} />
          {journal ? (
            event.ends_at ? (
              "Ends " + clock(event.ends_at)
            ) : (
              "End time unknown"
            )
          ) : (
            <>
              {clock(event.starts_at)}
              {event.ends_at
                ? " – " + clock(event.ends_at)
                : " · End time unknown"}
            </>
          )}
        </span>
        <span>
          <MapPin size={14} />
          {event.venue}
        </span>
      </motion.div>
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
        <motion.div
          variants={journal && !reduced ? actionVariants : undefined}
          className="card-actions"
        >
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
        </motion.div>
      )}
    </motion.article>
  );
}
