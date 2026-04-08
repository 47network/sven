// src/components/AccountSwitcher.tsx
import { useState } from 'react';
import { Users, Plus, Lock, Trash2, Check } from 'lucide-react';
import type { SavedAccount } from '../lib/api';

interface AccountSwitcherProps {
  accounts: SavedAccount[];
  token: string;
  onKeepSignedIn: (pin?: string) => Promise<void>;
  onSwitchAccount: (userId: string, pin?: string) => Promise<void>;
  onUnlinkAccount: (userId: string) => Promise<void>;
}

export function AccountSwitcher({
  accounts,
  token,
  onKeepSignedIn,
  onSwitchAccount,
  onUnlinkAccount,
}: AccountSwitcherProps) {
  const [showPinInput, setShowPinInput] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [showSavePin, setShowSavePin] = useState(false);
  const [savePin, setSavePin] = useState('');

  const handleSwitch = async (account: SavedAccount) => {
    if (account.isActive) return;
    if (account.hasPin) {
      setShowPinInput(account.userId);
      setPin('');
      return;
    }
    setSwitching(account.userId);
    try {
      await onSwitchAccount(account.userId);
    } finally {
      setSwitching(null);
    }
  };

  const handlePinSubmit = async (userId: string) => {
    setSwitching(userId);
    try {
      await onSwitchAccount(userId, pin);
    } finally {
      setSwitching(null);
      setShowPinInput(null);
      setPin('');
    }
  };

  const handleKeepSignedIn = async () => {
    setSaving(true);
    try {
      await onKeepSignedIn(savePin.length >= 4 ? savePin : undefined);
    } finally {
      setSaving(false);
      setShowSavePin(false);
      setSavePin('');
    }
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12, padding: '0 4px',
        color: 'var(--text-secondary)',
        fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        <Users size={14} />
        Saved Accounts
      </div>

      {accounts.length === 0 && (
        <div style={{
          padding: '16px 12px', textAlign: 'center',
          color: 'var(--text-tertiary)', fontSize: 13,
        }}>
          No saved accounts yet.
        </div>
      )}

      {accounts.map((account) => (
        <div key={account.userId} style={{ marginBottom: 4 }}>
          <button
            onClick={() => handleSwitch(account)}
            disabled={account.isActive || switching === account.userId}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', border: 'none', borderRadius: 8,
              background: account.isActive ? 'var(--accent-bg)' : 'transparent',
              color: 'var(--text-primary)', cursor: account.isActive ? 'default' : 'pointer',
              fontSize: 14, textAlign: 'left',
              opacity: switching === account.userId ? 0.6 : 1,
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => {
              if (!account.isActive) (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)';
            }}
            onMouseLeave={(e) => {
              if (!account.isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: account.isActive ? 'var(--accent)' : 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: account.isActive ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 14,
              flexShrink: 0,
            }}>
              {(account.username || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {account.displayName || account.username}
              </div>
              {account.displayName && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>@{account.username}</div>
              )}
            </div>
            {account.hasPin && <Lock size={14} style={{ color: 'var(--text-tertiary)' }} />}
            {account.isActive && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                padding: '2px 8px', borderRadius: 6,
                background: 'var(--accent-bg)',
              }}>
                <Check size={12} style={{ marginRight: 2 }} />Active
              </span>
            )}
            {!account.isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnlinkAccount(account.userId); }}
                title="Remove account"
                style={{
                  background: 'none', border: 'none', padding: 4,
                  cursor: 'pointer', color: 'var(--text-tertiary)',
                  borderRadius: 4,
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </button>

          {showPinInput === account.userId && (
            <div style={{
              display: 'flex', gap: 8, padding: '8px 12px',
              alignItems: 'center',
            }}>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter' && pin.length >= 4) handlePinSubmit(account.userId); }}
                autoFocus
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--input-bg)', color: 'var(--text-primary)',
                  fontSize: 16, letterSpacing: 4,
                }}
              />
              <button
                onClick={() => handlePinSubmit(account.userId)}
                disabled={pin.length < 4}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
                  opacity: pin.length >= 4 ? 1 : 0.5,
                  fontSize: 13,
                }}
              >
                Unlock
              </button>
              <button
                onClick={() => { setShowPinInput(null); setPin(''); }}
                style={{
                  padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Keep me signed in / Add account */}
      {token && (
        <div style={{ marginTop: 12, padding: '0 4px' }}>
          {!showSavePin ? (
            <button
              onClick={() => setShowSavePin(true)}
              disabled={saving}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', border: '1px dashed var(--border)',
                borderRadius: 8, background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: 13, justifyContent: 'center',
                transition: 'border-color 150ms, color 150ms',
              }}
            >
              <Plus size={16} />
              Keep me signed in
            </button>
          ) : (
            <div style={{
              padding: 12, border: '1px solid var(--border)',
              borderRadius: 8, background: 'var(--card-bg)',
            }}>
              <div style={{
                fontSize: 13, color: 'var(--text-secondary)',
                marginBottom: 8,
              }}>
                Set an optional PIN (4-8 digits) to protect account switching:
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="PIN (optional)"
                value={savePin}
                onChange={(e) => setSavePin(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', marginBottom: 8,
                  background: 'var(--input-bg)', color: 'var(--text-primary)',
                  fontSize: 16, letterSpacing: 4,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleKeepSignedIn}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowSavePin(false); setSavePin(''); }}
                  style={{
                    padding: '8px 16px', borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
