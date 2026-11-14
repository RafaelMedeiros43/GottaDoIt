import type { Task } from '@/lib/types'

let counter = 0

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1

  return {
    id: `task-${counter}`,
    title: `Tarefa ${counter}`,
    description: null,
    due_date: null,
    due_time: null,
    recurrence_rule: null,
    recurrence_text: null,
    priority: 4,
    is_completed: false,
    completed_at: null,
    position: counter,
    project_id: null,
    section_id: null,
    parent_task_id: null,
    label_ids: [],
    created_at: '2026-11-14T08:00:00+00:00',
    updated_at: '2026-11-14T08:00:00+00:00',
    ...overrides,
  }
}
