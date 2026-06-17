## Context

Four independently deployable fixes to lesson metadata and roadmap UI. No new infrastructure, no new dependencies, no data model changes. All changes are confined to frontend source files: `src/lib/course-data.ts`, `src/app/roadmap/page.tsx`, and the new `src/app/(course)/lesson/intro/course-timeline.tsx`.

The intro lesson previously rendered the same YouTube iframe wrapper as regular lessons — resulting in a black placeholder because the intro has no `youtubeId`. The roadmap stamp labels had been truncated to just the title with no lesson number, making it hard for students to navigate.

## Goals / Non-Goals

**Goals:**
- Lesson durations in `course-data.ts` match actual video lengths
- L6 subtitle uses precise domain term «когнитивных» instead of vague «мозговых»
- Roadmap lesson stamps show numbered titles for orientation
- Intro lesson modal shows meaningful content instead of a black video box

**Non-Goals:**
- No changes to lesson content, quiz logic, or certificate flow
- No new API routes or database changes
- No changes to stamp positioning, sizing, or roadmap layout

## Decisions

### D1: Inline duration corrections vs. CMS-driven
Static corrections in `course-data.ts` are sufficient — the file is the source of truth until a CMS is introduced. Updating 7 integers inline is the smallest correct change.

### D2: CourseTimeline as a standalone client component
The timeline is a self-contained animated list. Extracting it to `course-timeline.tsx` keeps `roadmap/page.tsx` (already large) uncluttered and makes the timeline independently testable. The intro branch in the video section stays as a single conditional: `lesson.id === 'intro' ? <CourseTimeline /> : <iframe wrapper>`.

### D3: STEPS data hardcoded in the component
The timeline displays a static overview of the course structure. Deriving it from `LESSONS` + `INTRO` + `FINALS` would add coupling without benefit — the timeline's descriptions are editorial copy that differs from lesson subtitles. Hardcoded STEPS is simpler and correct.

### D4: Stamp label format «N. Title» with 26-char truncation
The existing stamp component already truncates at 26 chars. Numbering uses `lesson.n` from `LESSONS`, which is the authoritative lesson number. Intro and final stamps use their existing `stamp.label` unchanged.

## Risks / Trade-offs

- **STEPS out of sync with course-data.ts** → If lessons are added or reordered, `STEPS` in `course-timeline.tsx` must be updated manually. Mitigation: derive from `LESSONS` in a future cleanup pass if course structure becomes dynamic.
- **Duration corrections are not validated** → No runtime check ensures `duration` matches actual video length. Mitigation: durations are verified by the author against actual recordings before commit.

## Migration Plan

All changes are pure frontend with no database migrations. Deployed directly to production — no feature flag, no rollback complexity beyond reverting the commit.
