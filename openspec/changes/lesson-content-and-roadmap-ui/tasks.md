## 1. Lesson metadata corrections

- [x] 1.1 Update `duration` for l1–l7 in `src/lib/course-data.ts` to match actual video lengths (22, 17, 43, 11, 26, 18, 12)
- [x] 1.2 Fix l6 subtitle: «мозговых процессов» → «когнитивных процессов» in `src/lib/course-data.ts`

## 2. Roadmap stamp labels

- [x] 2.1 Update `RoadmapStamp` label computation in `src/app/roadmap/page.tsx` to produce «N. Title» for lesson stamps; keep intro and final stamps unchanged
- [x] 2.2 Apply 26-char truncation with «…» to numbered lesson labels

## 3. CourseTimeline intro component

- [x] 3.1 Create `src/app/(course)/lesson/intro/course-timeline.tsx` with animated STEPS list (8 rows: Урок 1–7 + Финал)
- [x] 3.2 Replace black video placeholder in intro lesson modal (`src/app/roadmap/page.tsx`) with `<CourseTimeline />`
