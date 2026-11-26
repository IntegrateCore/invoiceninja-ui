import { describe, expect, it } from 'vitest';
import { consultingHoursWarning } from '../../../../src/pages/tasks/common/helpers/consulting-hours-warning';

const hours = (balance: number, funded = true, threshold = 2) => ({
  consulting_hours_balance: balance,
  consulting_hours_funded: funded,
  consulting_hours_warn_at: threshold,
});

describe('New Task consulting hours warning', () => {
  it('does not warn for unconfigured clients or missing data', () => {
    expect(consultingHoursWarning(undefined, 'en-US')).toBeNull();
    expect(consultingHoursWarning(hours(0, false), 'en-US')).toBeNull();
  });

  it('uses the threshold and remaining balance from the server', () => {
    expect(consultingHoursWarning(hours(2.01), 'en-US')).toBeNull();
    expect(consultingHoursWarning(hours(2), 'en-US')).toEqual({
      depleted: false,
      remaining: '2',
    });
    expect(consultingHoursWarning(hours(0.75, true, 0.5), 'en-US')).toBeNull();
  });

  it('formats fractional hours in the active locale', () => {
    expect(consultingHoursWarning(hours(1.25), 'fr-FR')).toEqual({
      depleted: false,
      remaining: '1,25',
    });
  });

  it('does not display a negative time remaining for depleted balances', () => {
    for (const balance of [0, -0.5]) {
      expect(consultingHoursWarning(hours(balance), 'en-US')).toEqual({
        depleted: true,
        remaining: '0',
      });
    }
  });

  it('does not show a warning using invalid numeric data', () => {
    expect(consultingHoursWarning(hours(NaN), 'en-US')).toBeNull();
    expect(
      consultingHoursWarning(hours(2, true, Infinity), 'en-US')
    ).toBeNull();
  });
});
