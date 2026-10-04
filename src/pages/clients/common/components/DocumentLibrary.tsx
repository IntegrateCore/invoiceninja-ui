import { useHasPermission } from '$app/common/hooks/permissions/useHasPermission';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { File, Folder } from 'react-feather';
import { endpoint } from '$app/common/helpers';
import { request } from '$app/common/helpers/request';
import { Card, CardContainer } from '$app/components/cards';
import { Button } from '$app/components/forms';

interface LibraryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
  id?: string;
  is_public?: boolean;
}
interface LibraryListing {
  path: string;
  folder: string;
  entries: LibraryEntry[];
}

export function DocumentLibrary({ clientId }: { clientId: string }) {
  const [t] = useTranslation();
  const hasPermission = useHasPermission();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = endpoint('/api/v1/clients/:id/file-library', { id: clientId });
  const listing = useQuery<LibraryListing>({
    queryKey: ['document-library', clientId, path],
    queryFn: () =>
      request('GET', `${base}/browse?path=${encodeURIComponent(path)}`).then(
        (response) => response.data.data
      ),
  });
  const download = async (entry?: LibraryEntry) => {
    setBusy(true);
    setError('');
    try {
      const url = entry
        ? endpoint('/api/v1/documents/:id/download', { id: entry.id })
        : `${base}/archive?path=${encodeURIComponent(path)}`;
      const response = await request('GET', url, {}, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download =
        entry?.name ??
        `${path.split('/').pop() || listing.data?.folder || 'Documents'}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setError(String(t('client_library_download_failed')));
    } finally {
      setBusy(false);
    }
  };
  const setVisibility = async (entry: LibraryEntry) => {
    setBusy(true);
    setError('');
    try {
      await request(
        'PUT',
        endpoint('/api/v1/documents/:id', { id: entry.id }),
        { is_public: !entry.is_public }
      );
      await listing.refetch();
    } catch {
      setError(String(t('client_library_failed')));
    } finally {
      setBusy(false);
    }
  };
  const ancestors = path.split('/').filter(Boolean);
  return (
    <Card title={t('documents')} className="mb-4">
      <CardContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label={String(t('documents'))}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <button
              type="button"
              onClick={() => setPath('')}
              className="underline"
            >
              {t('documents')}
            </button>
            {ancestors.map((name, index) => (
              <span key={index} className="flex items-center gap-2">
                <span aria-hidden="true">/</span>
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    setPath(ancestors.slice(0, index + 1).join('/'))
                  }
                >
                  {name}
                </button>
              </span>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">
            <Button
              behavior="button"
              type="secondary"
              disabled={listing.isFetching || busy}
              onClick={() => listing.refetch()}
            >
              {t('client_library_refresh')}
            </Button>
            <Button
              behavior="button"
              disabled={busy || !listing.data?.entries.length}
              onClick={() => download()}
            >
              {t(busy ? 'processing' : 'client_library_zip')}
            </Button>
          </div>
        </div>
        {(listing.isError || error) && (
          <p role="alert" className="text-sm">
            {error || t('client_library_failed')}
          </p>
        )}
        {listing.isFetching && (
          <p role="status" className="text-sm">
            {t('loading')}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b">
                <th className="py-3 font-medium">{t('name')}</th>
                <th className="p-3 font-medium">{t('size')}</th>
                <th className="p-3 font-medium">
                  {t('client_library_visibility')}
                </th>
                <th className="p-3">
                  <span className="sr-only">{t('download')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {listing.data?.entries.map((entry) => (
                <tr key={entry.path} className="border-b">
                  <td className="py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        entry.is_dir ? setPath(entry.path) : download(entry)
                      }
                      className="flex items-center gap-3 text-left hover:underline"
                    >
                      <span className="flex-shrink-0" aria-hidden="true">
                        {entry.is_dir ? (
                          <Folder size={20} color="#c49a25" />
                        ) : (
                          <File size={20} />
                        )}
                      </span>
                      <span className="break-words">{entry.name}</span>
                    </button>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {entry.is_dir
                      ? '—'
                      : `${((entry.size ?? 0) / 1024).toFixed(1)} KB`}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {!entry.is_dir &&
                      (hasPermission('edit_client') ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="underline"
                          onClick={() => setVisibility(entry)}
                          title={String(
                            t(
                              entry.is_public
                                ? 'client_library_make_private'
                                : 'client_library_make_shared'
                            )
                          )}
                        >
                          {t(
                            entry.is_public
                              ? 'client_library_shared'
                              : 'client_library_private'
                          )}
                        </button>
                      ) : (
                        t(
                          entry.is_public
                            ? 'client_library_shared'
                            : 'client_library_private'
                        )
                      ))}
                  </td>
                  <td className="p-3 text-right">
                    {!entry.is_dir && (
                      <button
                        type="button"
                        disabled={busy}
                        className="underline"
                        onClick={() => download(entry)}
                      >
                        {t('download')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {listing.data?.entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6">
                    {t('client_library_empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContainer>
    </Card>
  );
}
