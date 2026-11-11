import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  replace?: boolean;
  /** false keeps the scroll position (Next's `scroll={false}`). */
  scroll?: boolean;
  /** Accepted for compatibility and ignored - nothing is ever prefetched. */
  prefetch?: boolean;
};

const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Client-side navigation link. Deliberately does no prefetching of any kind:
 * hovering or scrolling past a link (e.g. the sidebar) never fires a request -
 * a page's data loads only when the page is opened. Absolute URLs and API
 * file routes render a plain <a>.
 */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, replace, scroll, prefetch: _prefetch, ...props },
  ref,
) {
  if (EXTERNAL.test(href) || href.startsWith("/api/")) {
    return <a ref={ref} href={href} {...props} />;
  }
  return (
    <RouterLink
      ref={ref}
      to={href}
      replace={replace}
      preventScrollReset={scroll === false}
      {...props}
    />
  );
});

export default Link;
