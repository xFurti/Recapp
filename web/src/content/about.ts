export type LocalizedText = { it: string; en: string }

export interface Creator {
  id: string
  name: string
  role: LocalizedText
  bio: LocalizedText
  photo?: { src: string; alt: LocalizedText }
  links?: { label: string; href: string }[]
}

export const faqItems = [
  { id: 'purpose' },
  { id: 'school' },
  { id: 'demo' },
  { id: 'access' },
  { id: 'rotation' },
  { id: 'sources' },
  { id: 'data', link: { to: '/privacy', labelKey: 'landing.privacy' } },
  { id: 'team', link: { to: '#creators', labelKey: 'about.creators_title' } },
] as const

// Add only team-supplied profiles and personal links. Do not publish guessed identities.
export const creators: Creator[] = []

export function localized(text: LocalizedText, language: string): string {
  return language.startsWith('en') ? text.en : text.it
}
