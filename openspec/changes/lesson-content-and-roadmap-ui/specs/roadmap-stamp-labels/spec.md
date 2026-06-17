## MODIFIED Requirements

### Requirement: Lesson stamps display numbered titles
Each lesson stamp on the roadmap MUST show a numbered label in the format «N. Title» to help students orient themselves on the map.

#### Scenario: Lesson stamp shows number prefix
- **WHEN** a student views the roadmap
- **THEN** each lesson stamp label reads «N. Title» (e.g. «1. Что такое нейрокоучинг», «2. Уточнение цели и результата»)

#### Scenario: Intro and final stamps are unchanged
- **WHEN** a student views the roadmap
- **THEN** the intro stamp and the final stamp retain their original labels without a number prefix

#### Scenario: Long labels are truncated
- **WHEN** a lesson title produces a label longer than 26 characters
- **THEN** the label is truncated to 24 characters with «…» appended
