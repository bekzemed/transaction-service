import { AMOUNT_SATURATION, calculateRisk } from './calculate-risk';
import type { RiskTaskInput } from './risk.types';

function input(overrides: Partial<RiskTaskInput> = {}): RiskTaskInput {
  return {
    transactionLineId: 'tl-1',
    amount: 100,
    currency: 'USD',
    timestampMs: Date.UTC(2026, 6, 20, 12, 0, 0),
    ...overrides,
  };
}

describe('calculateRisk', () => {
  it('returns a deterministic integer in [1, 100]', () => {
    const first = calculateRisk(input());
    const second = calculateRisk(input());

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(1);
    expect(first).toBeLessThanOrEqual(100);
    expect(Number.isInteger(first)).toBe(true);
  });

  it('scores a small midday USD payment in the low band', () => {
    expect(calculateRisk(input())).toBe(9);
  });

  it('scores a large overnight exotic-currency payment much higher', () => {
    expect(
      calculateRisk(
        input({
          amount: AMOUNT_SATURATION,
          currency: 'ETB',
          timestampMs: Date.UTC(2026, 6, 20, 3, 0, 0),
        }),
      ),
    ).toBe(94);
  });

  it('treats late-evening hours as riskier than business hours', () => {
    const evening = calculateRisk(
      input({ timestampMs: Date.UTC(2026, 6, 20, 22, 0, 0) }),
    );
    const midday = calculateRisk(
      input({ timestampMs: Date.UTC(2026, 6, 20, 12, 0, 0) }),
    );
    const overnight = calculateRisk(
      input({ timestampMs: Date.UTC(2026, 6, 20, 5, 0, 0) }),
    );

    expect(evening).toBeGreaterThan(midday);
    expect(overnight).toBeGreaterThan(evening);
  });

  it('treats non-low-risk currencies as riskier', () => {
    const usd = calculateRisk(input({ currency: 'USD' }));
    const etb = calculateRisk(input({ currency: 'ETB' }));

    expect(etb).toBeGreaterThan(usd);
  });

  it('saturates the amount factor at AMOUNT_SATURATION', () => {
    const atCap = calculateRisk(input({ amount: AMOUNT_SATURATION }));
    const aboveCap = calculateRisk(input({ amount: AMOUNT_SATURATION * 4 }));

    expect(aboveCap).toBe(atCap);
    expect(atCap).toBeGreaterThan(calculateRisk(input({ amount: 100 })));
  });

  it('does not let a negative amount pull the score below 1', () => {
    expect(calculateRisk(input({ amount: -500 }))).toBeGreaterThanOrEqual(1);
  });
});
