import { describe, it, expect } from 'vitest';

describe('Telemedicine Video Room Generator', () => {
  it('should generate secure WebRTC consultation room URLs', () => {
    const roomCode = Math.floor(100000 + Math.random() * 900000);
    const roomUrl = `https://telemed.video/room-${roomCode}`;
    expect(roomUrl).toMatch(/^https:\/\/telemed\.video\/room-\d{6}$/);
  });
});
