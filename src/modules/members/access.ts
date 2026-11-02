import type { Repositories } from "@/server/repositories";

/**
 * Member-area access follows the money.
 *
 * Granting and revoking live side by side on purpose: they have to stay mirrored. A sale
 * that is given back but keeps the access is the whole business risk of a digital product —
 * the buyer has the file, the producer lost the money, and nothing in the system notices.
 */
export async function grantOrderAccess(repos: Repositories, orderId: string, customerId: string): Promise<void> {
  for (const productId of await repos.orders.productIds(orderId)) {
    const course = await repos.courses.findByProductId(productId);
    if (course) await repos.courses.enroll({ courseId: course.id, customerId, orderId });
  }
}

export async function revokeOrderAccess(repos: Repositories, orderId: string, customerId: string): Promise<void> {
  for (const productId of await repos.orders.productIds(orderId)) {
    const course = await repos.courses.findByProductId(productId);
    if (course) await repos.courses.revokeEnrollment(course.id, customerId);
  }
}
