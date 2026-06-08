export const OFFER_TO_COURSE: Record<string, string> = {
  "5223845": "neurocoaching-intro",
  "5241770": "neurocoaching-intro",
  "5410171": "neurocoaching-intro",
  "6460338": "neurocoaching-intro",
}

export const PRODUCT_TO_COURSE: Record<string, string> = {
  "829285153": "neurocoaching-intro",
}

export function getCourseIdByOfferId(offerId: string): string | null {
  return OFFER_TO_COURSE[offerId] ?? null
}

export function getCourseIdByProductId(productId: string): string | null {
  return PRODUCT_TO_COURSE[productId] ?? null
}
