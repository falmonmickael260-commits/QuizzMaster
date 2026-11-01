import { expect, it, vi } from 'vitest';
it('reprend la même session lorsque les stockages de l’iframe sont bloqués', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1; static CONNECTING = 0;
    readyState = 1;
    sent: string[] = [];
    onopen?: () => void;
    onclose?: () => void;
    onmessage?: (event: { data: string }) => void;
    constructor() { sockets.push(this); }
    send(raw: string) { this.sent.push(raw); }
  }
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  vi.stubGlobal('WebSocket', FakeSocket); vi.stubGlobal('location', { protocol: 'https:', host: 'game.test' });
  vi.stubGlobal('sessionStorage', blocked); vi.stubGlobal('localStorage', blocked); vi.stubGlobal('window', undefined);
  try {
    const { useGame } = await import('../src/lib/net');
    useGame.getState().connect(); sockets[0].onopen?.();
    sockets[0].onmessage?.({ data: JSON.stringify({ t: 'welcome', state: { code: 'BQ-1234' }, token: 'native-local-session', playerId: 'bob', private: {} }) });
    sockets[0].readyState = 3;
    useGame.getState().connect(); sockets[1].onopen?.();
    expect(sockets[1].sent.map(raw => JSON.parse(raw))).toContainEqual({ t: 'resume', code: 'BQ-1234', token: 'native-local-session' });
  } finally { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
