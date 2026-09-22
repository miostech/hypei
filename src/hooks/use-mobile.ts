import * as React from "react"

const MOBILE_BREAKPOINT = 768

const query = () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

function subscribe(onChange: () => void) {
  const mql = query()
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/** Subscribes to the media query instead of syncing it into state inside an effect. */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false, // server snapshot
  )
}
