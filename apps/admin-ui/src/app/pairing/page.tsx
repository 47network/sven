'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useApprovePairing, useDenyPairing, usePairingRequests } from '@/lib/hooks';
import { Smartphone, CheckCircle2, XCircle, ShieldBan } from 'lucide-react';
import { toast } from 'sonner';

type PairingRequestRow = {
  id: string;
  channel: string;
  sender_id: string;
  code: string;
  created_at: string;
  expires_at: string;
};

function toPairingRows(value: unknown): PairingRequestRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      channel: String(item.channel ?? ''),
      sender_id: String(item.sender_id ?? ''),
      code: String(item.code ?? ''),
      created_at: String(item.created_at ?? ''),
      expires_at: String(item.expires_at ?? ''),
    }));
}

export default function PairingPage() {
  const { data, isLoading } = usePairingRequests({ status: 'pending', limit: 200 });
  const approve = useApprovePairing();
  const deny = useDenyPairing();

  if (isLoading) return <PageSpinner />;

  const pairingRequests = toPairingRows(data?.data);

  function handleApprove(channel: string, code: string) {
    approve.mutate(
      { channel, code },
      {
        onSuccess: () => toast.success('Pairing approved'),
        onError: () => toast.error('Approval failed'),
      },
    );
  }

  function handleDeny(channel: string, code: string, block: boolean) {
    deny.mutate(
      { channel, code, block },
      {
        onSuccess: () => toast.success(block ? 'Pairing denied and sender blocked' : 'Pairing denied'),
        onError: () => toast.error('Deny failed'),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Device Pairing"
        description="Approve or deny channel and device pairing requests"
      />

      {pairingRequests.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No pairing requests"
          description="New device or channel pairing requests will appear here for approval."
        />
      ) : (
        <div className="space-y-3">
          {pairingRequests.map((req) => (
            <div key={req.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {req.channel}:{req.sender_id}
                </p>
                <p className="text-sm text-slate-500">
                  Code <span className="font-semibold">{req.code}</span> &middot; Requested{' '}
                  {new Date(req.created_at).toLocaleString()} &middot; Expires{' '}
                  {new Date(req.expires_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(req.channel, req.code)}
                  disabled={approve.isPending || deny.isPending}
                  className="btn-primary btn-sm flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleDeny(req.channel, req.code, false)}
                  disabled={approve.isPending || deny.isPending}
                  className="btn-secondary btn-sm flex items-center gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" /> Deny
                </button>
                <button
                  onClick={() => handleDeny(req.channel, req.code, true)}
                  disabled={approve.isPending || deny.isPending}
                  className="btn-danger btn-sm flex items-center gap-1"
                >
                  <ShieldBan className="h-3.5 w-3.5" /> Deny + Block
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
