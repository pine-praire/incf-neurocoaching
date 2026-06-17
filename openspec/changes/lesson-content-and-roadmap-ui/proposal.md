## Why

Several data and UI inconsistencies were identified after the initial launch: lesson durations in course-data.ts did not match the actual video lengths, the l6 subtitle contained an imprecise term ("мозговых"), lesson stamps on the roadmap showed only truncated titles with no numbering, and the intro lesson modal displayed a useless black video placeholder instead of meaningful content.

## What Changes

- **Lesson durations corrected** in `src/lib/course-data.ts` for all 7 lessons to match actual video lengths
- **L6 subtitle fixed**: «Коммуникация на основе понимания мозговых процессов» → «Коммуникация на основе понимания когнитивных процессов»
- **Roadmap stamp labels** for lesson stamps now include the lesson number: «N. Title» format (e.g. «1. Что такое нейрокоучинг»); intro and final stamps are unchanged
- **CourseTimeline component** created at `src/app/(course)/lesson/intro/course-timeline.tsx` — replaces the black video placeholder in the intro lesson modal with an animated step-by-step list of all 8 course steps

## Capabilities

### New Capabilities

- `course-timeline-intro`: Animated course overview shown in the intro lesson modal, listing all steps with label, title, description, duration, and XP

### Modified Capabilities

- `lesson-metadata-accuracy`: Lesson duration and subtitle fields in course-data.ts MUST reflect actual content (correct video lengths, precise terminology)
- `roadmap-stamp-labels`: Lesson stamps on the roadmap MUST display numbered titles to help students orient themselves on the map

## Impact

- `src/lib/course-data.ts` — duration fields for l1–l7, subtitle for l6
- `src/app/roadmap/page.tsx` — label computation in `RoadmapStamp`, import of `CourseTimeline`
- `src/app/(course)/lesson/intro/course-timeline.tsx` — new component (created)
