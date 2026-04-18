// Batch 53: Agent Scheduling & Calendar — shared types

export type ScheduleType =
  | 'one_time'
  | 'recurring'
  | 'cron'
  | 'interval'
  | 'event_driven';

export type ScheduleStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export type CalendarEventType =
  | 'task'
  | 'meeting'
  | 'maintenance'
  | 'deployment'
  | 'review'
  | 'training'
  | 'break';

export type CalendarEventStatus =
  | 'tentative'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'rescheduled';

export type BookingSlotStatus =
  | 'available'
  | 'booked'
  | 'held'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type TriggerType =
  | 'task'
  | 'notification'
  | 'webhook'
  | 'nats_publish'
  | 'chain';

export type SchedulingAction =
  | 'schedule_create'
  | 'schedule_pause'
  | 'event_create'
  | 'event_cancel'
  | 'availability_set'
  | 'slot_book'
  | 'trigger_configure';

export interface AgentSchedule {
  id: string;
  agentId: string;
  scheduleType: ScheduleType;
  title: string;
  description?: string;
  cronExpr?: string;
  timezone: string;
  startAt: string;
  endAt?: string;
  recurrenceRule?: string;
  status: ScheduleStatus;
  metadata: Record<string, unknown>;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  agentId: string;
  eventType: CalendarEventType;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  recurrenceRule?: string;
  status: CalendarEventStatus;
  priority: string;
  attendees: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityWindow {
  id: string;
  agentId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isAvailable: boolean;
  overrideDate?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BookingSlot {
  id: string;
  agentId: string;
  slotType: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: BookingSlotStatus;
  bookedBy?: string;
  priceTokens: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTrigger {
  id: string;
  scheduleId: string;
  triggerType: TriggerType;
  actionPayload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  lastStatus: string;
  lastError?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const SCHEDULE_TYPES: ScheduleType[] = [
  'one_time', 'recurring', 'cron', 'interval', 'event_driven',
];

export const SCHEDULE_STATUSES: ScheduleStatus[] = [
  'active', 'paused', 'completed', 'cancelled', 'expired', 'failed',
];

export const CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  'task', 'meeting', 'maintenance', 'deployment', 'review', 'training', 'break',
];

export const CALENDAR_EVENT_STATUSES: CalendarEventStatus[] = [
  'tentative', 'confirmed', 'cancelled', 'completed', 'rescheduled',
];

export const BOOKING_SLOT_STATUSES: BookingSlotStatus[] = [
  'available', 'booked', 'held', 'completed', 'cancelled', 'expired',
];

export const SCHEDULING_ACTIONS: SchedulingAction[] = [
  'schedule_create', 'schedule_pause', 'event_create',
  'event_cancel', 'availability_set', 'slot_book', 'trigger_configure',
];

export function isScheduleRunnable(status: ScheduleStatus): boolean {
  return status === 'active';
}

export function isSlotBookable(status: BookingSlotStatus): boolean {
  return status === 'available' || status === 'held';
}

export function hasConflict(a: { startAt: string; endAt: string }, b: { startAt: string; endAt: string }): boolean {
  return a.startAt < b.endAt && a.endAt > b.startAt;
}

export function getNextOccurrence(cronExpr: string, _after: string): string | null {
  if (!cronExpr) return null;
  return new Date(Date.now() + 3600_000).toISOString();
}
