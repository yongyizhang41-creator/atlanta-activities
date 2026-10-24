"use client";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { entrance, layoutSpring } from "@/components/motion/variants";
import type { Activity, Plan } from "@/lib/types";
import { groupActivityDays } from "./dayGroups";
import EventCard from "./EventCard";

export default function EventDayGroups({
  items,
  plans,
  partial,
  onOpen,
  onAdd,
  onHighlight,
}: {
  items: Activity[];
  plans: Plan[];
  partial: boolean;
  onOpen: (event: Activity) => void;
  onAdd: (event: Activity, status: "maybe" | "going") => void;
  onHighlight?: (id: string | null) => void;
}) {
  const reduced = !!useReducedMotion();
  return (
    <LayoutGroup>
      <div className="weekend-journal">
        <AnimatePresence initial={true} mode="popLayout">
          {groupActivityDays(items).map((group, dayIndex) => (
            <motion.section
              layout={reduced ? false : "position"}
              transition={layoutSpring}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="journal-day"
              key={group.date}
              aria-labelledby={`journal-${group.date}`}
            >
              <motion.header
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.4,
                  delay: reduced ? 0 : Math.min(dayIndex, 5) * 0.06,
                }}
                className="journal-day-heading"
              >
                <h2 id={`journal-${group.date}`}>
                  <time dateTime={group.date}>{group.label}</time>
                </h2>
                <span>
                  {group.events.length}{" "}
                  {group.events.length === 1 ? "activity" : "activities"}
                  {partial ? " loaded" : ""}
                </span>
              </motion.header>
              <ol className="journal-entries">
                <AnimatePresence mode="popLayout">
                  {group.events.map((event, index) => (
                    <motion.li
                      layout={reduced ? false : "position"}
                      {...entrance(index, reduced)}
                      className="journal-entry"
                      key={event.id}
                    >
                      <EventCard
                        journal
                        onHighlight={onHighlight}
                        event={event}
                        plan={plans.find((plan) => plan.event_id === event.id)}
                        onOpen={() => onOpen(event)}
                        onAdd={(status) => onAdd(event, status)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
