## MODIFIED Requirements

### Requirement: Lesson duration reflects actual video length
The `duration` field for each lesson in `course-data.ts` MUST match the actual length of the corresponding video content in minutes.

#### Scenario: Correct durations stored
- **WHEN** a student opens a lesson modal
- **THEN** the displayed duration matches the actual video length: l1=22, l2=17, l3=43, l4=11, l5=26, l6=18, l7=12

### Requirement: Lesson subtitle uses precise terminology
Each lesson subtitle MUST use accurate domain terminology. Vague or imprecise terms SHALL be corrected when identified.

#### Scenario: L6 subtitle uses correct term
- **WHEN** a student views lesson 6 («Построение эффективного общения»)
- **THEN** the subtitle reads «Коммуникация на основе понимания когнитивных процессов» (not «мозговых процессов»)
