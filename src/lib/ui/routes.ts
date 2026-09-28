import type { Route } from "next";

/**
 * Typed hrefs for the member area. `typedRoutes` can only verify template literals
 * written inline, so the single cast lives here — the segments always come from
 * route params or database slugs that were already resolved.
 */
export const memberHomeHref = (organizationSlug: string) => `/members/${organizationSlug}` as Route;

export const memberCourseHref = (organizationSlug: string, courseSlug: string) =>
  `/members/${organizationSlug}/courses/${courseSlug}` as Route;

export const memberLessonHref = (organizationSlug: string, courseSlug: string, lessonId: string) =>
  `/members/${organizationSlug}/courses/${courseSlug}/${lessonId}` as Route;
