import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CreatorSlideshow } from '../src/components/CreatorSlideshow'
import type { Creator } from '../src/content/about'
import '../src/i18n'
import '../src/index.css'

// Synthetic test fixtures; never imported by the application.
const profiles: Creator[] = [
  { id: 'a', name: 'Fixture A', role: { it: 'Ruolo di prova', en: 'Test role' }, bio: { it: 'Presentazione di prova.', en: 'Test introduction.' } },
  { id: 'b', name: 'Fixture B', role: { it: 'Ruolo di prova', en: 'Test role' }, bio: { it: 'Testo lungo di prova. '.repeat(45), en: 'Long test introduction. '.repeat(45) }, photo: { src: '/missing-photo.webp', alt: { it: 'Foto di prova', en: 'Test photo' } }, links: [{ label: 'Example', href: 'https://example.com/' }] },
  { id: 'c', name: 'Fixture C', role: { it: 'Ruolo di prova', en: 'Test role' }, bio: { it: 'Prova con immagine.', en: 'Image test.' }, photo: { src: '/src/assets/recapp-icon.png', alt: { it: 'Grafica di prova', en: 'Test artwork' } } },
]
createRoot(document.getElementById('root')!).render(<StrictMode><main className="mx-auto max-w-3xl p-5"><CreatorSlideshow profiles={location.search.includes('empty') ? [] : location.search.includes('single') ? profiles.slice(0, 1) : profiles} /></main></StrictMode>)
