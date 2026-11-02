/**
 * Whether a buyer who pays for this product actually receives something.
 *
 * The member area is the only delivery channel today, so a product delivers when it has
 * content that is published and has at least one lesson. Without that the checkout still
 * charges, the payment still lands in the ledger, and the confirmation e-mail goes out
 * with no access link — a silent failure the producer only hears about from the customer.
 */
export type ProductDelivery =
  | { ready: true; courseId: string }
  /** No content was ever created for this product. */
  | { ready: false; reason: "missing" }
  /** Content exists but has no lesson: the buyer gets in and finds nothing. */
  | { ready: false; reason: "empty"; courseId: string }
  /** Content is ready but still a draft, so the member area hides it. */
  | { ready: false; reason: "unpublished"; courseId: string };

export type ProductDeliveryIssue = Extract<ProductDelivery, { ready: false }>["reason"];

export interface ProductContentSummary {
  id: string;
  published: boolean;
  lessons: number;
}

export function classifyDelivery(content: ProductContentSummary | null): ProductDelivery {
  if (!content) return { ready: false, reason: "missing" };
  // Publishing already requires a lesson, but lessons can be removed afterwards.
  if (content.lessons === 0) return { ready: false, reason: "empty", courseId: content.id };
  if (!content.published) return { ready: false, reason: "unpublished", courseId: content.id };
  return { ready: true, courseId: content.id };
}
