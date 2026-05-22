export const OFFER_TO_COURSE: Record<string, string> = {
  "5410171": "neurocoaching-intro",
  "6460338": "neurocoaching-intro",
}

export function getCourseIdByOfferId(offerId: string): string | null {
  return OFFER_TO_COURSE[offerId] ?? null
}
