// src/lib/course-data.ts
// Source of truth for course content. In production this will be seeded
// from MDX files into Supabase — for now it lives here as typed constants.

export interface Lesson {
  id: string
  n: number
  title: string
  subtitle: string
  lecturer: string
  duration: number
  xp: number
  task: string | null
  fact: string
  factTag: string
  pre?: string
  blockId: string
  nativePitch?: string // module name for L1 mention (lessons 2 and 5 only)
  youtubeId?: string
}

export interface Block {
  id: string
  title: string
  tagline: string
  badgeLabel: string
}

export interface Final {
  id: string
  type: 'test' | 'reflection'
  title: string
  subtitle: string
  xp: number
}

export const BLOCKS: Block[] = [
  { id: 'b1', title: 'Введение в нейрокоучинг', tagline: 'С чего начинается работа с мозгом', badgeLabel: 'Введение освоено' },
  { id: 'b2', title: 'Нейробиология принятия решений', tagline: 'Почему мы выбираем то, что выбираем', badgeLabel: 'Решения изучены' },
  { id: 'b3', title: 'Практическое применение', tagline: 'Где нейрокоучинг работает каждый день', badgeLabel: 'Практика — рулит' },
]

export const LESSONS: Lesson[] = [
  {
    id: 'l1', n: 1, blockId: 'b1',
    title: 'Что такое нейрокоучинг',
    subtitle: 'Определение, принципы, этика',
    lecturer: 'Александра Болдина',
    duration: 12, xp: 50,
    task: 'Запиши одно предложение: за чем ты пришла на курс?',
    fact: 'Слово «коучинг» — из венгерского "kocsi szekér" — повозка из города Кочи. Дословно — то, что довозит до цели.',
    factTag: 'Этимология',
    pre: 'До следующего урока: вспомни три ситуации, где ты замечала, как мозг подсказывает решение.',
    youtubeId: 'gP7CY4szUbg',
  },
  {
    id: 'l2', n: 2, blockId: 'b1',
    title: 'Потенциал мозга',
    subtitle: 'Нейропластичность: как мозг учится и приспосабливается',
    lecturer: 'Валентина Груздева',
    duration: 14, xp: 60,
    task: 'Назови один навык, который ты освоила за последний год. Что в мозге могло поменяться?',
    fact: 'Мозг весит ~2% массы тела, но забирает 20% всей энергии — рекордсмен среди органов.',
    factTag: 'Нейрофизиология',
    pre: 'До следующего урока: посмотри одну демо-сессию коуча на YouTube и заметь, что делает коуч.',
    nativePitch: '«Нейрофизиология» (модуль 2)',
  },
  {
    id: 'l3', n: 3, blockId: 'b1',
    title: 'Демо-сессии',
    subtitle: 'Как выглядит работа нейрокоуча в реальности',
    lecturer: 'Александра Болдина',
    duration: 18, xp: 50,
    task: 'Какой вопрос коуча показался самым сильным? Запиши его дословно.',
    fact: '30 секунд — окно после инсайта, когда мозг ещё «горячий». Если в эти 30 секунд сформулировать действие, шанс выполнить его вырастает втрое.',
    factTag: 'Коучинг',
  },
  {
    id: 'l4', n: 4, blockId: 'b2',
    title: 'Как мозг принимает решения',
    subtitle: 'Нейронаука, когнитивные искажения, интуиция против логики',
    lecturer: 'Валентина Груздева',
    duration: 15, xp: 70,
    task: null,
    fact: 'До 95% решений мы принимаем неосознанно. Кора большого мозга чаще всего рационализирует уже принятое — постфактум.',
    factTag: 'Нейронаука',
  },
  {
    id: 'l5', n: 5, blockId: 'b2',
    title: 'Коучинг изменений',
    subtitle: 'Техники принятия решений в нейрокоучинге',
    lecturer: 'Александра Болдина',
    duration: 13, xp: 70,
    task: 'Опиши решение, которое ты откладываешь. Что мешает мозгу его принять?',
    fact: 'Среднее время формирования новой привычки — 66 дней, а не 21, как принято считать. Источник — исследование UCL, 2009.',
    factTag: 'Привычки',
    pre: 'До следующего урока: подумай о коммуникации, где тебя «не слышат». Чего там не хватает?',
    nativePitch: '«Когнитивные искажения» (модуль 4)',
  },
  {
    id: 'l6', n: 6, blockId: 'b3',
    title: 'Построение эффективного общения',
    subtitle: 'Коммуникация на основе понимания мозговых процессов',
    lecturer: 'Екатерина Ларина',
    duration: 14, xp: 70,
    task: 'Запиши одну фразу-«разморозку», которую попробуешь в ближайшем разговоре.',
    fact: 'Зеркальные нейроны активны, даже когда мы просто слушаем. Поэтому коуч буквально «настраивается» на состояние клиента.',
    factTag: 'Зеркальные нейроны',
  },
  {
    id: 'l7', n: 7, blockId: 'b3',
    title: 'Стресс и управление эмоциями',
    subtitle: 'Эмоциональная регуляция и техники снижения стресса',
    lecturer: 'Александра Болдина',
    duration: 16, xp: 80,
    task: 'Сделай дыхание 4-7-8 один раз и опиши одним словом, что почувствовала.',
    fact: 'Глубокий выдох длиннее вдоха активирует парасимпатическую нервную систему примерно за 90 секунд — самый быстрый способ снизить стресс без таблеток.',
    factTag: 'Физиология стресса',
  },
]

export const FINALS: Final[] = [
  { id: 'test', type: 'test', title: 'Итоговый тест', subtitle: '10 вопросов о ключевых концепциях', xp: 150 },
  { id: 'six',  type: 'reflection', title: '6 финальных вопросов', subtitle: 'Рефлексия после курса — что осталось внутри', xp: 100 },
]

export const INTRO = {
  id: 'intro',
  title: 'Краткое руководство',
  desc: 'Как устроен курс, как двигаться по карте и где искать помощь.',
  duration: 3,
  xp: 20,
}

export const LEVELS = [
  { min: 0,   title: 'Любопытный новичок' },
  { min: 80,  title: 'Исследователь мозга' },
  { min: 220, title: 'Практик' },
  { min: 400, title: 'Уверенный коуч' },
  { min: 620, title: 'Нейрокоуч' },
]

export function computeLevel(xp: number) {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) idx = i
  }
  const cur = LEVELS[idx]
  const next = LEVELS[idx + 1]
  const ratio = next ? Math.min(1, (xp - cur.min) / (next.min - cur.min)) : 1
  return { idx, title: cur.title, ratio, nextAt: next?.min ?? null }
}

export function computeXP(completed: Set<string>): number {
  let xp = 0
  if (completed.has('intro')) xp += INTRO.xp
  LESSONS.forEach(l => { if (completed.has(l.id)) xp += l.xp })
  FINALS.forEach(f => { if (completed.has(f.id)) xp += f.xp })
  return xp
}

export function blockProgress(blockId: string, completed: Set<string>) {
  const lessons = LESSONS.filter(l => l.blockId === blockId)
  const done = lessons.filter(l => completed.has(l.id)).length
  return { done, total: lessons.length, ratio: done / lessons.length }
}