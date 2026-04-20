'use client';

import type { EidolonEvent } from '@/lib/api';
import { formatBucharestTime } from '@/lib/time';

const KIND_ACCENT: Partial<Record<EidolonEvent['kind'], string>> = {
  'market.listing_published': 'text-brand-400',
  'market.order_paid': 'text-emerald-300',
  'market.fulfilled': 'text-emerald-400',
  'market.refunded': 'text-rose-300',
  'market.task_created': 'text-sky-300',
  'market.task_completed': 'text-sky-400',
  'treasury.credit': 'text-amber-300',
  'treasury.debit': 'text-rose-300',
  'agent.spawned': 'text-violet-300',
  'agent.retired': 'text-slate-400',
  'agent.profile_updated': 'text-violet-200',
  'agent.tokens_earned': 'text-amber-200',
  'agent.moved': 'text-sky-200',
  'agent.built_structure': 'text-amber-400',
  'agent.parcel_acquired': 'text-emerald-300',
  'agent.avatar_changed': 'text-violet-200',
  'agent.anomaly_detected': 'text-red-400',
  'agent.report_generated': 'text-cyan-300',
  'agent.message_sent': 'text-violet-300',
  'agent.business_created': 'text-emerald-400',
  'agent.business_activated': 'text-emerald-300',
  'agent.business_deactivated': 'text-slate-400',
  'oversight.command_issued': 'text-rose-400',
  'crew.created': 'text-pink-300',
  'crew.member_added': 'text-pink-200',
  'goal.progress': 'text-teal-300',
  'goal.completed': 'text-cyan-300',
  'publishing.project_created': 'text-violet-300',
  'publishing.stage_advanced': 'text-violet-200',
  'publishing.review_submitted': 'text-pink-300',
  'publishing.book_published': 'text-violet-400',
  'world.tick': 'text-gray-500',
  'world.parcel_interaction': 'text-cyan-300',
  'infra.node_change': 'text-sky-300',
  heartbeat: 'text-slate-600',
};

interface Props { events: EidolonEvent[] }

export function EventFeed({ events }: Props) {
  const visible = events.filter((e) => e.kind !== 'heartbeat').slice(0, 40);
  return (
    <div className="glass-card p-4 max-h-[50vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-widest text-gray-400">Live Feed</div>
        <div className="text-[10px] text-gray-500">{visible.length} events</div>
      </div>
      <div className="overflow-y-auto pr-1 space-y-1.5">
        {visible.length === 0 ? (
          <div className="text-xs text-gray-500">Awaiting signals from the economy…</div>
        ) : (
          visible.map((ev) => (
            <div key={ev.id} className="text-xs">
              <span className="text-[10px] text-gray-500 font-mono" title={`Romanian time (Europe/Bucharest)`}>
                {formatBucharestTime(ev.at)}
              </span>
              <span className={`ml-2 font-medium ${KIND_ACCENT[ev.kind] ?? 'text-gray-300'}`}>
                {ev.kind}
              </span>
              <span className="ml-2 text-gray-400 break-all">{summarise(ev.payload)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function summarise(payload: EidolonEvent['payload']): string {
  const entries = Object.entries(payload).slice(0, 3);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}=${v}`).join(' · ');
}
