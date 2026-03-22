import { parseSettingValue } from './settings-utils.js';

export type VoiceShortcutAction = {
  scope: 'ha.write';
  tool_name: 'ha.call_service';
  inputs: {
    service: string;
    entity_id?: string;
  };
  matched_text: string;
};

const LIGHTS_OFF_PATTERNS: RegExp[] = [
  /\b(?:lights?|light)\s+off\b/i,
  /\bturn\s+off\s+(?:the\s+)?(?:lights?|light)\b/i,
  /\bswitch\s+off\s+(?:the\s+)?(?:lights?|light)\b/i,
];

const LIGHTS_ON_PATTERNS: RegExp[] = [
  /\b(?:lights?|light)\s+on\b/i,
  /\bturn\s+on\s+(?:the\s+)?(?:lights?|light)\b/i,
  /\bswitch\s+on\s+(?:the\s+)?(?:lights?|light)\b/i,
];

const SWITCH_OFF_PATTERNS: RegExp[] = [
  /\bturn\s+off\s+(?:the\s+)?switch\b/i,
  /\bswitch\s+off\s+(?:the\s+)?switch\b/i,
];

const SWITCH_ON_PATTERNS: RegExp[] = [
  /\bturn\s+on\s+(?:the\s+)?switch\b/i,
  /\bswitch\s+on\s+(?:the\s+)?switch\b/i,
];

export function parseVoiceShortcut(text: string): VoiceShortcutAction | null {
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  if (LIGHTS_OFF_PATTERNS.some((p) => p.test(normalized))) {
    return {
      scope: 'ha.write',
      tool_name: 'ha.call_service',
      inputs: { service: 'light.turn_off' },
      matched_text: normalized,
    };
  }
  if (LIGHTS_ON_PATTERNS.some((p) => p.test(normalized))) {
    return {
      scope: 'ha.write',
      tool_name: 'ha.call_service',
      inputs: { service: 'light.turn_on' },
      matched_text: normalized,
    };
  }
  if (SWITCH_OFF_PATTERNS.some((p) => p.test(normalized))) {
    return {
      scope: 'ha.write',
      tool_name: 'ha.call_service',
      inputs: { service: 'switch.turn_off' },
      matched_text: normalized,
    };
  }
  if (SWITCH_ON_PATTERNS.some((p) => p.test(normalized))) {
    return {
      scope: 'ha.write',
      tool_name: 'ha.call_service',
      inputs: { service: 'switch.turn_on' },
      matched_text: normalized,
    };
  }
  return null;
}

export function parseAllowedShortcutServices(
  raw: unknown,
  fallback: string[],
): Set<string> {
  const parsed = parseSettingValue(raw);
  if (Array.isArray(parsed)) {
    const values = parsed
      .map((v) => String(v || '').trim().toLowerCase())
      .filter(Boolean);
    return new Set(values);
  }
  if (typeof parsed === 'string') {
    const values = parsed
      .split(/[\n,]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    return new Set(values);
  }
  return new Set(fallback);
}
