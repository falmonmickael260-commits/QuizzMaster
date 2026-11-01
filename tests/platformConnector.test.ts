import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Room } from '../server/game/room';
import type { Command } from '../platform-connector/server.mjs';
it('invitation : identité, capacité réelle, reprise et invités conservés', async () => {
  const room = new Room('BQ-1234', { getPlayablePool: async () => [], recordUsage: async () => {}, recordAnswers: async () => {} });
  try {
    const host = randomUUID(), bob = randomUUID();
    const a = room.addPlayer('Alice', 'nova', { platformUserId: host });
    const c: Command = { v: 1, game: 'quiz-master', operation: 'admit', room: room.code, uid: bob, name: 'Bob', inviter: host,
      invitation: randomUUID(), instance: `${room.code}:${room.createdAt}`, proof: { code: room.code, token: a.token } };
    expect(room.platformSnapshot(c).count).toBe(1);
    const b = room.platformAdmit(c);
    expect(room.platformAdmit(c)).toEqual(b);
    expect(room.resume(b.token!).platformUserId).toBe(bob);
    let anonymous;
    for (let i = 0; i < 6; i++) anonymous = room.addPlayer(`Invité ${i}`, 'nova');
    expect(() => room.platformSnapshot({ ...c, uid: bob, inviter: undefined, proof: { code: room.code, token: anonymous!.token } })).toThrow(/déjà une place/);
    expect(() => room.platformAdmit({ ...c, uid: randomUUID() })).toThrow(/complet/);
    expect(() => room.platformSnapshot({ ...c, proof: { code: room.code, token: 'forged' } })).toThrow();
    expect(() => room.platformAdmit({ ...c, instance: 'old' })).toThrow();
  } finally { room.dispose(); }
});
