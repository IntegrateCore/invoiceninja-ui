import { describe, expect, test } from 'vitest';
import { isConsultingHoursCustomField } from '../../../src/pages/clients/common/helpers/consulting-hours';

describe('reserved mobile consulting hours field', () => {
  const fields = ['client1', 'client2', 'client3', 'client4'];

  test.each([1, 2, 3, 4])('excludes only reserved slot %i', (slot) => {
    const company = { consulting_hours_custom_field: slot };

    expect(
      fields.filter((field) => !isConsultingHoursCustomField(company, field))
    ).toEqual(fields.filter((_, index) => index + 1 !== slot));
    expect(
      isConsultingHoursCustomField(company, 'consulting_hours_balance')
    ).toBe(false);
    expect(isConsultingHoursCustomField(company, 'contact1')).toBe(false);
  });

  test('keeps every field when the backend has no active reservation', () => {
    for (const company of [{}, { consulting_hours_custom_field: 0 }]) {
      expect(
        fields.some((field) => isConsultingHoursCustomField(company, field))
      ).toBe(false);
    }
  });

  test('preserves an ordinary custom field with the same visible label', () => {
    const company = {
      consulting_hours_custom_field: 2,
      custom_fields: {
        client1: 'Time left (hours)',
        client2: 'Time left (hours)',
      },
    };

    expect(isConsultingHoursCustomField(company, 'client1')).toBe(false);
    expect(isConsultingHoursCustomField(company, 'client2')).toBe(true);
  });
});
