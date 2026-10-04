export type LocalizedText = { it: string; en: string }

export interface Creator {
  id: string
  name: string
  role: LocalizedText
  bio: LocalizedText
  photo?: { src: string; alt: LocalizedText; fit?: 'cover' | 'contain' }
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
export const creators: Creator[] = [
  { id: 'leonardo', name: 'Leonardo Bassanello', className: '4bi', photo: { src: '/creators/leonardo.webp', alt: { it: 'Avatar di Leonardo Bassanello', en: 'Avatar of Leonardo Bassanello' } } },
  { id: 'luca', name: 'Luca Cremonese', className: '4bi', photo: { src: '/creators/luca.webp', alt: { it: 'Grafica di Magilla Gorilla per Luca Cremonese', en: 'Magilla Gorilla artwork for Luca Cremonese' }, fit: 'contain' as const } },
  { id: 'oleksi', name: 'Oleksii Holovan', className: '4ai', photo: { src: '/creators/oleksi.webp', alt: { it: 'Logo personale di Oleksii Holovan', en: 'Personal logo of Oleksii Holovan' }, fit: 'contain' as const } },
].map(({ id, name, className, photo }) => ({
  id,
  name,
  photo,
  role: { it: 'Developer e creatore', en: 'Developer and creator' },
  bio: { it: `17 anni - ${className}`, en: `17 years old - ${className}` },
}))

export function localized(text: LocalizedText, language: string): string {
  return language.startsWith('en') ? text.en : text.it
}
