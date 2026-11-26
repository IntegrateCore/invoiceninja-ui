import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { endpoint } from '$app/common/helpers';
import { request } from '$app/common/helpers/request';
import { useCurrentCompany } from '$app/common/hooks/useCurrentCompany';
import { Alert } from '$app/components/Alert';
import {
  type ConsultingHoursSnapshot,
  consultingHoursWarning,
} from '../helpers/consulting-hours-warning';

export function ConsultingHoursWarning({ clientId }: { clientId: string }) {
  const [t, i18n] = useTranslation();
  const company = useCurrentCompany();
  const { data, isError } = useQuery({
    queryKey: ['task-consulting-hours', company?.id, clientId],
    queryFn: async ({ signal }) => {
      const response = await request(
        'GET',
        endpoint('/api/v1/clients/:id/consulting_hours', { id: clientId }),
        undefined,
        { signal, skipIntercept: true }
      );
      return response.data.data as ConsultingHoursSnapshot;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });

  const warning = !isError && consultingHoursWarning(data, i18n.language);

  if (!warning) {
    return null;
  }

  return (
    <Alert type="warning" className="w-full" disableClosing>
      <p role="status">
        {warning.depleted
          ? t('task_consulting_hours_depleted', {
              defaultValue:
                'This client has run out of consulting time. {{remaining}} hours remaining.',
              remaining: warning.remaining,
            })
          : t('task_consulting_hours_low', {
              defaultValue:
                'This client is about to run out of consulting time. {{remaining}} hours remaining.',
              remaining: warning.remaining,
            })}
      </p>
    </Alert>
  );
}
