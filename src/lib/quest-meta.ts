// IDs уроков, у которых есть квест дня.
// Менять синхронно с questQuestionsBank.lessons в quest-questions-bank.ts.
// TODO: добавить тест-ассерт в test suite (см. задачу по тестам progress/unlock):
//   expect(QUEST_LESSON_IDS).toEqual(questQuestionsBank.lessons.map(l => l.lessonId))
export const QUEST_LESSON_IDS = ['l1', 'l2', 'l4', 'l5', 'l6', 'l7'] as const
export type QuestLessonId = (typeof QUEST_LESSON_IDS)[number]
