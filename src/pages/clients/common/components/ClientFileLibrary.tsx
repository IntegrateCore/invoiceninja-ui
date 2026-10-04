import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { endpoint } from '$app/common/helpers';
import { request } from '$app/common/helpers/request';
import { useAdmin } from '$app/common/hooks/permissions/useHasPermission';
import { useCurrentCompany } from '$app/common/hooks/useCurrentCompany';
import { $refetch } from '$app/common/hooks/useRefetch';
import { Card, CardContainer } from '$app/components/cards';
import { Button, SelectField } from '$app/components/forms';
import {
  ClientFolderManager,
  type FolderAssignment,
  type FolderCatalog,
} from './ClientFolderManager';
import { DocumentLibrary } from './DocumentLibrary';

interface LibraryStatus {
  enabled: boolean;
  folder: string | null;
  library_url: string | null;
  pending_migrations: number;
  document_count: number;
  privacy_review_count: number;
}

export function ClientFileLibrary({
  clientId,
  onConnectionChange,
}: {
  clientId: string;
  onConnectionChange?: (connected: boolean) => void;
}) {
  const [t] = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin, isOwner } = useAdmin();
  const company = useCurrentCompany();
  const canEdit = isAdmin || isOwner;
  const url = endpoint('/api/v1/clients/:id/file-library', { id: clientId });
  const status = useQuery<LibraryStatus>({
    queryKey: ['client-file-library', clientId],
    queryFn: () => request('GET', url).then((response) => response.data.data),
  });
  const folders = useQuery<FolderCatalog>({
    queryKey: ['client-folder-catalog', company.id],
    queryFn: () =>
      request('GET', endpoint('/api/v1/client-file-folders')).then(
        (response) => response.data
      ),
    enabled: canEdit && status.data?.enabled === true,
  });
  useEffect(() => {
    onConnectionChange?.(Boolean(status.data?.folder));
  }, [status.data?.folder, onConnectionChange]);
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const folderOptions: FolderAssignment[] =
    canEdit && folders.data
      ? folders.data.data
      : status.data?.folder
        ? [
            {
              folder: status.data.folder,
              client_id: clientId,
              client_name: null,
              assigned: true,
              assigned_to_other_company: false,
            },
          ]
        : [];
  const selectedAssignment = folders.data?.data.find(
    (assignment) => assignment.folder === folder
  );
  const isTransfer = Boolean(
    selectedAssignment?.client_id &&
      selectedAssignment.client_id !== clientId &&
      !selectedAssignment.assigned_to_other_company
  );

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
      await queryClient.invalidateQueries({
        queryKey: ['client-file-library'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['document-library'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['client-folder-catalog'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['client-file-library-folders'],
      });
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
    <>
      <Card title={t('client_file_library')} className="mb-4">
        <CardContainer>
          <p className="text-sm">{t('client_library_description')}</p>
          {canEdit && <ClientFolderManager />}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-lg">
              <SelectField
                label={t('client_library_folder')}
                value={folder}
                onValueChange={setFolder}
                disabled={!canEdit || busy}
                withBlank
                placeholder={t('client_library_choose')}
              >
                {folderOptions.map((assignment) => (
                  <option
                    key={assignment.folder}
                    value={assignment.folder}
                    disabled={assignment.assigned_to_other_company}
                  >
                    {assignment.folder} —{' '}
                    {assignment.assigned_to_other_company
                      ? t('client_library_other_company')
                      : assignment.client_id === clientId
                        ? t('client_library_current_client')
                        : assignment.client_id
                          ? t('client_library_transfer_option', {
                              client: assignment.client_name ?? t('client'),
                            })
                          : t('client_library_unassigned')}
                  </option>
                ))}
              </SelectField>
            </div>
            {canEdit && folder !== (status.data.folder ?? '') && (
              <Button
                behavior="button"
                disabled={
                  busy ||
                  !folder ||
                  selectedAssignment?.assigned_to_other_company
                }
                onClick={() => save()}
              >
                {t(
                  busy
                    ? 'processing'
                    : status.data.folder
                      ? 'save'
                      : 'client_library_connect'
                )}
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
          {canEdit && isTransfer && (
            <p role="status" className="text-sm">
              {t('client_library_transfer_notice', {
                client: selectedAssignment?.client_name ?? t('client'),
              })}
            </p>
          )}
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
              {status.data.privacy_review_count > 0 && (
                <p role="status">{t('client_library_review_visibility')}</p>
              )}
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
      {status.data.folder && (
        <DocumentLibrary
          key={`${clientId}:${status.data.folder}`}
          clientId={clientId}
        />
      )}
    </>
  );
}
