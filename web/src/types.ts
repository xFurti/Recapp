export type ItemType = 'compito' | 'verifica' | 'evento' | 'lab'
export type ItemSource = 'detto in classe' | 'ClasseViva' | 'Classroom' | 'Campus' | 'altro'
export type LessonStatus = 'svolta' | 'non_svolta' | 'supplenza' | 'verifica'
export type DayStatus = 'no_school' | 'published' | 'future' | 'open' | 'draft' | 'not_started'

export interface MemberBrief {
  id: number
  nick: string
  color: string
}

export interface Classroom {
  code: string
  name: string
  label: string
  is_demo: boolean
}

export interface Subject {
  code: string
  name_it: string
  name_en: string
  color: string
}

export interface HourSlot {
  hour: number
  start: string
  end: string
}

export interface ClassInfo extends Classroom {
  subjects: Subject[]
  hours: HourSlot[]
  viewer: {
    kind: 'member' | 'owner'
    member: (MemberBrief & { role: 'admin' | 'member' }) | null
    can_manage: boolean
    read_only: boolean
    tour_seen: boolean
  }
}

export type Me =
  | { kind: 'anonymous' }
  | { kind: 'member'; member: MemberBrief & { role: 'admin' | 'member' }; classroom: Classroom }
  | { kind: 'owner'; owner: { username: string; display_name: string } }

export interface PublicClass extends Classroom {
  members: { id: number; nick: string; needs_setup: boolean; color: string }[]
}

export interface Lesson {
  subject_code: string
  hours: number[]
  hours_label: string
  start: string
  end: string
  room: string
  is_lab: boolean
}

export interface LabData {
  goal: string
  repo_url: string
  pitfall: string
  bring: string
}

export interface Entry {
  subject_code: string
  hours: string
  room: string
  is_lab: boolean
  lesson_status: LessonStatus
  bullets: string[]
  lab: LabData | null
  attachment_ids: number[]
}

export interface Item {
  id: number
  type: ItemType
  subject_code: string | null
  title: string
  due_date: string
  due_time: string | null
  source: ItemSource
  link: string
  attachment_id: number | null
  author: MemberBrief | null
  status: 'draft' | 'published'
  card_day: string | null
  can_edit?: boolean
}

export interface Card {
  id: number
  day: string
  status: 'draft' | 'published'
  author: MemberBrief | null
  scribe: MemberBrief | null
  notes: string
  revision: number
  published_at: string | null
  updated_at: string | null
  entries: Entry[]
  items: Item[]
  attachments: { id: number; width: number; height: number }[]
}

export interface DayStateInfo {
  day: string
  is_school_day: boolean
  no_school_reason: string
  status: DayStatus
  scribe: MemberBrief | null
  override_reason: 'swap' | 'takeover' | 'pass' | null
  is_me_scribe: boolean
  has_draft: boolean
  can_write: boolean
  can_takeover: boolean
  can_pass: boolean
  takeover_at: string
}

export interface TodayInfo extends DayStateInfo {
  now: string
  lessons: Lesson[]
  card: Card | null
  draft_updated_at?: string
  next_school_day: { day: string; scribe: MemberBrief | null } | null
  upcoming_soon: Item[]
  next_lessons: Record<string, string>
  open_corrections: number
}

export interface CardPage {
  state: DayStateInfo
  card: Card | null
  lessons: Lesson[]
  next_lessons: Record<string, string>
  prev_published: string | null
  next_published: string | null
}

export interface SubjectEntryRow {
  day: string
  author: MemberBrief | null
  hours: string
  room: string
  is_lab: boolean
  lesson_status: LessonStatus
  bullets: string[]
  lab: LabData | null
  attachment_ids: number[]
  items: Item[]
}

export interface CardSummary {
  day: string
  author: MemberBrief | null
  subjects: string[]
  has_lab: boolean
  items: number
  published_at: string | null
}

export interface MemberRow {
  id: number
  nick: string
  role: 'admin' | 'member'
  color: string
  activated: boolean
  needs_setup: boolean
  rotation_order: number
  is_today_scribe: boolean
  days_written: number
  items_added: number
  is_me: boolean
}

export interface RotationDay {
  day: string
  school: boolean
  reason?: string
  scribe?: MemberBrief | null
  override_reason?: string | null
  card_status?: 'draft' | 'published' | null
}

export interface Invite {
  member_id: number
  nick: string
  invite: string
  join_url: string
}

export interface Draft {
  type: ItemType
  subject_code: string | null
  title: string
  due_date: string
  due_time: string | null
  source: ItemSource
  needs_check: boolean
  check_reason: string
}

export interface TimetableData {
  hours: HourSlot[]
  timezone: string
  subjects: Subject[]
  slots: { weekday: number; hour: number; subject_code: string; room: string; is_lab: boolean }[]
  can_edit: boolean
}

export interface OwnerClass extends Classroom {
  last_published: string | null
  published_this_week: number
  members_total: number
  members_active: number
  admins: string[]
}
