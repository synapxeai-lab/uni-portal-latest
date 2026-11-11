import { useEffect } from "react";
import { useNavigate, type NavigateFunction } from "react-router";

let navigateRef: NavigateFunction | null = null;

/**
 * Lets non-component code (the API functions that replaced Server Actions)
 * navigate - e.g. "create class" lands in the new class, as the old action's
 * server-side redirect() did. Mounted once inside the router.
 */
export function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef = navigate;
    return () => {
      navigateRef = null;
    };
  }, [navigate]);
  return null;
}

export function navigateTo(href: string, options?: { replace?: boolean }): void {
  if (navigateRef) {
    navigateRef(href, options);
  } else {
    window.location.assign(href);
  }
}
