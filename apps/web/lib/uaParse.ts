/**
 * Minimal User-Agent parser for the sessions list.
 *
 * Returns a friendly "Chrome on macOS" style label without pulling in
 * ua-parser-js (~30kb). Covers the browsers and OSes we actually see;
 * anything else falls back to "Unknown device".
 */
export interface ParsedUserAgent {
  browser: string;
  os: string;
  label: string;
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', label: 'Unknown device' };

  const ua = userAgent;

  // Order matters — Edge and Opera pretend to be Chrome; Chrome pretends
  // to be Safari; check the more specific tokens first.
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /curl|wget|node|python|axios/i.test(ua) ? 'API client' :
    'Browser';

  const os =
    /Windows NT 10/.test(ua) ? 'Windows 10/11' :
    /Windows NT/.test(ua) ? 'Windows' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' :
    'Unknown OS';

  return { browser, os, label: `${browser} on ${os}` };
}
