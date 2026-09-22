/**
 * Shared Server Action result contract. Deliberately dependency-free so client
 * components can import it without pulling server-only modules into the browser bundle.
 */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const idleState: ActionState = { status: "idle" };
