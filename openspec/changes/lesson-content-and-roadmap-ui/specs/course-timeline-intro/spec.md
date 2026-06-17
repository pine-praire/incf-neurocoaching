## NEW Capability

### Capability: Animated course overview in intro lesson modal
The intro lesson modal MUST display an animated step-by-step list of all 8 course steps instead of a black video placeholder.

#### Scenario: Timeline renders all steps
- **WHEN** a student opens the intro lesson modal
- **THEN** a `CourseTimeline` component renders 8 rows: Урок 1–7 and Финал
- **AND** each row shows: label (e.g. «Урок 1»), title, description, duration, and XP

#### Scenario: Steps appear with animation
- **WHEN** the timeline mounts
- **THEN** each step fades in and slides up sequentially with a 120ms interval between steps

#### Scenario: Final step is visually distinct
- **WHEN** the final step (Тест + сертификат + звонок) is rendered
- **THEN** it uses a Star icon and terra colour instead of the muted Circle icon used for lesson steps

#### Scenario: No video placeholder shown for intro
- **WHEN** a student opens the intro lesson modal
- **THEN** no black video iframe or placeholder div is shown — only the CourseTimeline
