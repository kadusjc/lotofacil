import { loadConfig } from './configuration';

describe('config', () => {
  it('applies defaults', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3100);
    expect(c.betPrice).toBe(3.5);
    expect(c.syncOnStartup).toBe(false);
  });
  it('rejects invalid values', () => expect(() => loadConfig({ SCRAPE_CONCURRENCY: '99' })).toThrow(/inválida/));
});
