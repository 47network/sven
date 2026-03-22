import { describe, expect, it } from '@jest/globals';
import { parsePostPayload } from '../../../adapter-mattermost/src/index';
import { canvasBlockToText, describeNonTextMessage } from '../../../adapter-feishu/src/index';
import { parseIrcLine as parseIrcLineIrc, splitMessageLines as splitIrcLines } from '../../../adapter-irc/src/index';
import {
  parseIrcLine as parseIrcLineTwitch,
  parseChannels,
  normalizeChannel,
  normalizeOauthToken,
  splitMessageLines as splitTwitchLines,
} from '../../../adapter-twitch/src/index';
import { extractNextcloudInbound } from '../../../adapter-nextcloud-talk/src/index';
import { resolveNostrChatId, parseStringList, parseIntList } from '../../../adapter-nostr/src/index';
import { extractTlonInbound } from '../../../adapter-tlon/src/index';

describe('Adapter helper functions', () => {
  it('parses Mattermost post payload JSON', () => {
    const payload = JSON.stringify({
      id: 'post1',
      user_id: 'userA',
      channel_id: 'chan1',
      channel_type: 'D',
      message: 'hello',
    });
    const parsed = parsePostPayload(payload);
    expect(parsed?.id).toBe('post1');
    expect(parsed?.user_id).toBe('userA');
    expect(parsed?.channel_id).toBe('chan1');
    expect(parsed?.message).toBe('hello');
  });

  it('converts Feishu blocks to text and describes non-text', () => {
    const blockText = canvasBlockToText({ type: 'markdown', content: 'Hello **world**' } as any);
    expect(blockText).toContain('Hello');
    const desc = describeNonTextMessage('image', { foo: 'bar' });
    expect(desc).toBe('[image]');
  });

  it('parses IRC line and splits long messages', () => {
    const parsed = parseIrcLineIrc(':nick!user@host PRIVMSG #chan :hello there');
    expect(parsed?.command).toBe('PRIVMSG');
    const lines = splitIrcLines('a'.repeat(10), 4);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('parses Twitch tags and normalizes channel/oauth', () => {
    const parsed = parseIrcLineTwitch('@badges=moderator/1 :nick!user@host PRIVMSG #chan :hello');
    expect(parsed?.tags?.badges).toBe('moderator/1');
    expect(parseChannels('#Foo,bar')).toEqual(['foo', 'bar']);
    expect(normalizeChannel('#Foo')).toBe('foo');
    expect(normalizeOauthToken('abc')).toBe('oauth:abc');
    const lines = splitTwitchLines('a'.repeat(10), 4);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('extracts Nextcloud inbound payload fields', () => {
    const inbound = extractNextcloudInbound({
      actor: { id: 'user1' },
      room: { token: 'room1' },
      message: { message: 'hello', id: 'm1' },
    });
    expect(inbound.actorId).toBe('user1');
    expect(inbound.roomId).toBe('room1');
    expect(inbound.message).toBe('hello');
  });

  it('resolves Nostr chat id and parses lists', () => {
    const chatId = resolveNostrChatId({ tags: [['p', 'peer1']] });
    expect(chatId).toBe('nostr-peer:peer1');
    expect(parseStringList('a, b,,c')).toEqual(['a', 'b', 'c']);
    expect(parseIntList('1,2,x,3')).toEqual([1, 2, 3]);
  });

  it('extracts Tlon inbound payload fields', () => {
    const inbound = extractTlonInbound({
      sender_id: 'ship1',
      chat_id: 'chat1',
      text: 'hi',
      message_id: 'm1',
      chat_type: 'dm',
    });
    expect(inbound.senderId).toBe('ship1');
    expect(inbound.chatId).toBe('chat1');
    expect(inbound.text).toBe('hi');
    expect(inbound.chatType).toBe('dm');
  });
});
