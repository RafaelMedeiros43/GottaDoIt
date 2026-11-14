// Os objetos que a API devolve (ver docs/api.md).

export type Priority = 1 | 2 | 3 | 4

export interface User {
  id: string
  name: string
  email: string
  timezone: string
  /** 0 domingo, 1 segunda */
  week_start: 0 | 1
  theme: 'system' | 'light' | 'dark'
  notification_settings: {
    push: boolean
    email: boolean
    daily_digest: boolean
    daily_digest_time: string
  }
}

export interface Project {
  id: string
  parent_id: string | null
  name: string
  color: string
  icon: string | null
  view: 'list' | 'board'
  is_favorite: boolean
  position: number
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  /** YYYY-MM-DD, no fuso do utilizador */
  due_date: string | null
  /** HH:MM */
  due_time: string | null
  recurrence_rule: string | null
  recurrence_text: string | null
  priority: Priority
  is_completed: boolean
  completed_at: string | null
  position: number
  project_id: string | null
  section_id: string | null
  parent_task_id: string | null
  label_ids: string[]
  created_at: string
  updated_at: string
}

/** O corpo de POST /tasks. */
export interface NewTask {
  id: string
  title: string
  due_date: string | null
  due_time: string | null
  recurrence_rule: string | null
  recurrence_text: string | null
  priority: Priority
  project_name: string | null
  label_names: string[]
}
