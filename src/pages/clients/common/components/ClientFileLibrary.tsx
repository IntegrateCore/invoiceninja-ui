import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { endpoint } from '$app/common/helpers';
import { request } from '$app/common/helpers/request';
import { $refetch } from '$app/common/hooks/useRefetch';
import { useHasPermission } from '$app/common/hooks/permissions/useHasPermission';
import { Card, CardContainer } from '$app/components/cards';
import { Button, SelectField } from '$app/components/forms';

interface LibraryStatus {
  enabled: boolean;
  folder: string | null;
  library_url: string | null;
  pending_migrations: number;
  document_count: number;
}

export function ClientFileLibrary({ clientId }: { clientId: string }) {
  const [t] = useTranslation();
  const hasPermission = useHasPermission();
  const canEdit = hasPermission('edit_client');
  const url = endpoint('/api/v1/clients/:id/file-library', { id: clientId });
  const status = useQuery<LibraryStatus>({
    queryKey: ['client-file-library', clientId],
    queryFn: () => request('GET', url).then((response) => response.data.data),
  });
  const folders = useQuery<string[]>({
    queryKey: ['client-file-library-folders', clientId],
    queryFn: () => request('GET', `${url}/folders`).then((response) => response.data.data),
    enabled: canEdit && status.data?.enabled === true,
  });
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFolder(status.data?.folder ?? '');
  }, [status.data?.folder]);

  const save = async (refresh = false) => {
    setBusy(true);
    setError('');
    try {
      await request(
        refresh ? 'POST' : 'PUT',
        refresh ? `${url}/refresh` : url,
        {
          folder,
        }
      );
      await status.refetch();
      $refetch(['clients', 'documents']);
    } catch (failure: unknown) {
      const response = failure as {
        response?: {
          data?: { errors?: { folder?: string[] }; message?: string };
        };
      };
      setError(
        response.response?.data?.errors?.folder?.[0] ??
          String(t('client_library_failed'))
      );
    } finally {
      setBusy(false);
    }
  };

  if (status.isLoading) return null;
  if (status.isError) {
    return (
      <p role="alert" className="text-sm mb-4">
        {t('client_library_failed')}
      </p>
    );
  }
  if (!status.data?.enabled) return null;

  return (
    <Card title={t('client_file_library')} className="mb-4">
      <CardContainer>
        <p className="text-sm">{t('client_library_description')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-lg">
            <SelectField
              label={t('client_library_folder')}
              value={folder}
              onValueChange={setFolder}
              disabled={!canEdit || busy || Boolean(status.data.folder)}
              withBlank
              placeholder={t('client_library_choose')}
            >
              {(
                folders.data ?? (status.data.folder ? [status.data.folder] : [])
              ).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectField>
          </div>
          {canEdit && !status.data.folder && (
            <Button
              behavior="button"
              disabled={busy || !folder}
              onClick={() => save()}
            >
              {t(busy ? 'processing' : 'client_library_connect')}
            </Button>
          )}
          {canEdit && status.data.folder && (
            <Button
              behavior="button"
              type="secondary"
              disabled={busy}
              onClick={() => save(true)}
            >
              {t(busy ? 'processing' : 'client_library_refresh')}
            </Button>
          )}
        </div>
        {folders.isError && (
          <p role="alert" className="text-sm">
            {t('client_library_failed')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        {status.data.library_url && (
          <div className="flex flex-col gap-2 text-sm">
            <a
              className="underline break-all"
              href={status.data.library_url}
              target="_blank"
              rel="noreferrer"
            >
              {t('client_library_open')}
            </a>
            {status.data.pending_migrations > 0 && (
              <p role="status">
                {t('client_library_pending', {
                  count: status.data.pending_migrations,
                })}
              </p>
            )}
          </div>
        )}
      </CardContainer>
    </Card>
  );
}
