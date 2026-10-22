# ATL / Out — Design Context

Purpose: help Atlanta residents and Georgia Tech students choose what to do this week, then commit to a realistic plan. Product application; English locale, America/New_York time.

## Visual direction
Transit field guide for an active city. White and cool blue-gray surfaces, deep ink and electric cobalt, with restrained yellow sports/campus accents. Avoid generic landing-page heroes; the map and event schedule are the primary composition.

## Tokens
CSS owner: apps/web/src/app/globals.css. Canvas #f4f6fa; surface #ffffff; ink #16243a; muted #53647b; line #dce3ed; accent #2354d8; accent-soft #eaf0ff; campus #ffcf58; danger #b83232; success #18694c. Radius 12px cards, 8px controls, 24px page gutters. Space 4/8/12/16/24/32/48. Heading Georgia (restrained display for city names); body system sans; labels ui-monospace. No external fonts required.

## Layout and signature
Compact top navigation; editorial city heading; split explorer with filter rail, chronological activity cards and sticky full-height map. Signature: cobalt location pins and the linked date rail echo Atlanta transit signage. My Plans shares header, date formats, card actions and status vocabulary. Responsive below 900px stacks filters/list/map, with map occupying a bounded region.

## Interaction
Canonical ownership recorded in UX-CONTRACT.md. Button-based alternatives for every drag; source facts always distinguished from missing data. Application-owned errors and empty states, no native alert/confirm/prompt. Radix dialogs manage focus/Escape/return. Visible focus; reduced-motion; semantic controls; consistent disabled/loading feedback. No fake event counts or stock activities in production.
