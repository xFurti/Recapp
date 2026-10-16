import type { TFunction } from 'i18next'
import type { Entry, LabData } from '../types'

export function labNotes(lab: LabData, t: TFunction): string {
  // An explicit empty string means the combined notes were deliberately cleared.
  if (lab.notes != null) return lab.notes
  return (['goal', 'pitfall', 'bring'] as const)
    .filter(field => lab[field]?.trim())
    .map(field => `${t(`day.lab_${field}`)}: ${lab[field]}`)
    .join('\n\n')
}

export function editableLab(lab: LabData, t: TFunction): LabData {
  return { notes: labNotes(lab, t), repo_url: lab.repo_url, goal: '', pitfall: '', bring: '' }
}

export function hasLabContent(lab: LabData | null): boolean {
  return !!lab && [lab.notes ?? '', lab.repo_url, lab.goal, lab.pitfall, lab.bring].some(value => value?.trim())
}

export function hasEntrySummary(entry: Entry): boolean {
  return entry.is_lab || entry.bullets.some(bullet => bullet.trim()) || hasLabContent(entry.lab) || !!entry.attachment_ids?.length
}
