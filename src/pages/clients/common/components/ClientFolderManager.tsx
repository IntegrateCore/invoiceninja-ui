import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { endpoint } from '$app/common/helpers';
import { request } from '$app/common/helpers/request';
import { useAdmin } from '$app/common/hooks/permissions/useHasPermission';
import { useCurrentCompany } from '$app/common/hooks/useCurrentCompany';
import { $refetch } from '$app/common/hooks/useRefetch';
import { ClientSelector } from '$app/components/clients/ClientSelector';
import { Button } from '$app/components/forms';
import { Modal } from '$app/components/Modal';

interface FolderAssignment {
  folder: string;
  assigned: boolean;
  client_id: string | null;
  client_name: string | null;
  assigned_to_other_company: boolean;
}
interface FolderCatalog {
  enabled: boolean;
  data: FolderAssignment[];
}

function FolderRow({
  assignment,
  onSaved,
}: {
  assignment: FolderAssignment;
  onSaved: () => Promise<unknown>;
}) {
  const [t] = useTranslation();
  const [clientId, setClientId] = useState(assignment.client_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setClientId(assignment.client_id ?? '');
  }, [assignment.client_id]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await request('PUT', endpoint('/api/v1/client-file-folders'), {
        folder: assignment.folder,
        client_id: clientId || null,
      });
      await onSaved();
    } catch (failure: unknown) {
      const response = failure as {
        response?: {
          data?: {
            message?: string;
            errors?: { folder?: string[]; client_id?: string[] };
          };
        };
      };
      setError(
        response.response?.data?.errors?.folder?.[0] ??
          response.response?.data?.errors?.client_id?.[0] ??
          String(t('client_library_failed'))
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <tr className="border-b align-top">
      <td className="py-4 pr-4 break-words">{assignment.folder}</td>
      <td className="py-3 pr-4" style={{ minWidth: 220 }}>
        {assignment.assigned_to_other_company ? (
          <span>{t('client_library_other_company')}</span>
        ) : (
          <>
            <ClientSelector
              value={clientId}
              inputLabel={String(t('client'))}
              readonly={busy}
              withoutAction
              onChange={(client) => setClientId(client.id)}
              onClearButtonClick={() => setClientId('')}
            />
            <p className="text-xs mt-2">
              {assignment.client_name ?? t('client_library_unassigned')}
            </p>
            {error && (
              <p role="alert" className="mt-2 text-sm">
                {error}
              </p>
            )}
          </>
        )}
      </td>
      <td className="py-4 text-right">
        {!assignment.assigned_to_other_company && (
          <Button
            behavior="button"
            disableWithoutIcon
            disabled={busy || clientId === (assignment.client_id ?? '')}
            onClick={save}
          >
            {t(busy ? 'processing' : 'save')}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function ClientFolderManager() {
  const [t] = useTranslation();
  const { isAdmin, isOwner } = useAdmin();
  const company = useCurrentCompany();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const catalog = useQuery<FolderCatalog>({
    queryKey: ['client-folder-catalog', company.id],
    queryFn: () =>
      request('GET', endpoint('/api/v1/client-file-folders')).then(
        (response) => response.data
      ),
    enabled: isAdmin || isOwner,
  });
  const refresh = async () => {
    await catalog.refetch();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-file-library'] }),
      queryClient.invalidateQueries({ queryKey: ['document-library'] }),
      queryClient.invalidateQueries({
        queryKey: ['client-file-library-folders'],
      }),
    ]);
    $refetch(['clients', 'documents']);
  };
  if (!(isAdmin || isOwner) || catalog.data?.enabled === false) return null;
  return (
    <>
      <Button
        behavior="button"
        type="secondary"
        onClick={() => {
          setVisible(true);
          void catalog.refetch();
        }}
      >
        {t('client_library_manage')}
      </Button>
      <Modal
        visible={visible}
        onClose={() => setVisible(false)}
        title={t('client_library_manage')}
        size="large"
      >
        <p>{t('client_library_mapping_description')}</p>
        {catalog.isError && <p role="alert">{t('client_library_failed')}</p>}
        {catalog.isFetching && <p role="status">{t('loading')}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 font-medium">{t('folder')}</th>
                <th className="py-3 font-medium">{t('client')}</th>
                <th>
                  <span className="sr-only">{t('save')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {catalog.data?.data.map((assignment) => (
                <FolderRow
                  key={assignment.folder}
                  assignment={assignment}
                  onSaved={refresh}
                />
              ))}
            </tbody>
          </table>
          {catalog.data?.data.length === 0 && (
            <p className="py-4">{t('client_library_no_folders')}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            behavior="button"
            type="secondary"
            onClick={() => catalog.refetch()}
            disabled={catalog.isFetching}
          >
            {t('client_library_refresh')}
          </Button>
          <Button behavior="button" onClick={() => setVisible(false)}>
            {t('close')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
