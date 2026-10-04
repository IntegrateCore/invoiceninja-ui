import { Company } from '$app/common/interfaces/company.interface';

/** The mobile balance occupies one reserved slot; other custom fields remain. */
export function isConsultingHoursCustomField(
  company: Pick<Company, 'consulting_hours_custom_field'>,
  field: string
): boolean {
  return field === `client${company.consulting_hours_custom_field}`;
}
