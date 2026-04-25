const BASE_URL = 'https://tanishnahata.com';

export function buildUTMLink(baseUrl: string, source: string, medium: string, campaign: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}

export const UTM_LINKS = {
  linkedin: buildUTMLink(BASE_URL, 'linkedin', 'social', 'portfolio'),
  twitter: buildUTMLink(BASE_URL, 'twitter', 'social', 'portfolio'),
  resume: buildUTMLink(BASE_URL, 'resume', 'document', 'portfolio'),
  github: buildUTMLink(BASE_URL, 'github', 'referral', 'portfolio'),
  email: buildUTMLink(BASE_URL, 'email', 'email', 'portfolio'),
};
