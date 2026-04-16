import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize admin-supplied HTML before render/storage.
 *
 * Allowed: common formatting (p, h1-h6, a, img, ul/ol/li, blockquote, code, pre,
 * strong/em/u/s, br, hr, table family). NO scripts, event handlers, iframes,
 * forms, objects. Links are sanitized and forced to safe schemes.
 *
 * Used by:
 *   - `src/app/api/admin/recaps/route.ts` — sanitize on write (defense in depth)
 *   - `src/app/recaps/page.tsx` — sanitize on render (primary defense against
 *      legacy rows + future admin-compromise vectors)
 */
export function sanitizeRecapHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em', 'figure',
      'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
      'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'sup',
      'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
    ],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id', 'colspan', 'rowspan'],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcdoc', 'formaction'],
    ADD_ATTR: ['target', 'rel'],
    USE_PROFILES: { html: true },
  });
}
