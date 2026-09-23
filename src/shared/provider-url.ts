export interface ParsedProviderBaseURL {
  origin: string;
  normalizedBaseURL: string;
  permissionPattern: string;
  endpoint: string;
}

export function parseProviderBaseURL(
  input: string
): ParsedProviderBaseURL | undefined {
  const trimmed = input.trim();
  const authority = /^https?:\/\/([^/?#]*)/iu.exec(trimmed)?.[1];
  if (
    authority === undefined ||
    authority.length === 0 ||
    authority.includes('@')
  ) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';
  const schemeOk =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && isLoopback);

  if (
    !schemeOk ||
    parsed.hostname.length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    return undefined;
  }

  const origin = parsed.origin;
  const path = parsed.pathname.replace(/\/+$/u, '');
  const versionedPath = path.endsWith('/v1')
    ? path
    : path + '/v1';
  const endpointPath = versionedPath + '/chat/completions';

  return {
    origin,
    normalizedBaseURL: origin + path,
    permissionPattern: origin + '/*',
    endpoint: origin + endpointPath
  };
}
