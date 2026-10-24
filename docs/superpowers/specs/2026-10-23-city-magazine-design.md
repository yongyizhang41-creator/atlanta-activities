# Atlanta city weekend magazine — approved design

User approved the city lifestyle guide direction and this implementation on 2026-10-23.

Use the supplied Atlanta skyline as a bounded, colorful hero with a local dark text scrim. Remove the full-page photo. Keep the existing sans-serif family, navy ink, warm-white canvas, orange date accents and green plan actions. Increase event-list width, reduce map dominance and clamp card descriptions while retaining details. Desktop keeps filters/list/map visible. Mobile adds list/map switching with one shared filter state and map instance. Preserve auth, plans, reminders, geo selection, theme persistence and all API/business rules. Carry shared visual tokens into auth, plans and settings; do not invent event images, popularity or recommendations.

Approaches considered: city weekend magazine (selected for atmosphere plus usability); poster wall (depends on unavailable event images); nightlife guide (too narrow for campus/daytime activities). No new dependencies or business rules.
