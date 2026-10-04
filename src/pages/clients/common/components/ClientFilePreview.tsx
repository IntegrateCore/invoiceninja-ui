import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { endpoint } from '$app/common/helpers';
import { request } from '$app/common/helpers/request';
import { Button } from '$app/components/forms';
import { Modal } from '$app/components/Modal';

const imageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
};
const textExtensions = new Set([
  'txt',
  'text',
  'md',
  'markdown',
  'csv',
  'tsv',
  'log',
  'json',
  'yaml',
  'yml',
  'xml',
  'html',
  'htm',
  'svg',
  'css',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'py',
  'pyw',
  'deluge',
  'dg',
  'sql',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'php',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'ini',
  'conf',
  'cfg',
  'toml',
  'env',
  'bat',
  'cmd',
  'r',
  'vue',
  'svelte',
  'dart',
  'pl',
  'lua',
]);
export const filePreviewKind = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (Object.hasOwn(imageTypes, extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (textExtensions.has(extension)) return 'text';
  return null;
};
interface PreviewFile {
  name: string;
  id?: string;
  size: number | null;
}
interface Props {
  file: PreviewFile;
  onClose: () => void;
  onDownload: () => void;
}

export function ClientFilePreview({ file, onClose, onDownload }: Props) {
  const [t] = useTranslation();
  const [content, setContent] = useState('');
  const [objectUrl, setObjectUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const kind = filePreviewKind(file.name);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let url = '';
    const maximum = kind === 'text' ? 1024 * 1024 : 25 * 1024 * 1024;
    const load = async () => {
      setLoading(true);
      setError('');
      setContent('');
      setObjectUrl('');
      if (!file.id || !kind || (file.size ?? 0) > maximum) {
        setError(String(t('client_library_preview_unavailable')));
        setLoading(false);
        return;
      }
      try {
        const response = await request(
          'GET',
          endpoint('/api/v1/documents/:id/download', { id: file.id }),
          {},
          {
            responseType: 'blob',
            signal: controller.signal,
            skipIntercept: true,
            onDownloadProgress: (progress) => {
              if (progress.loaded > maximum) controller.abort();
            },
          }
        );
        const blob: Blob = response.data;
        if (blob.size > maximum) throw new Error('Preview size exceeded');
        if (kind === 'text') {
          const text = await blob.text();
          if (text.includes('\u0000')) throw new Error('Binary content');
          if (active) setContent(text);
        } else {
          const prefix = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
          const starts = (...bytes: number[]) =>
            bytes.every((byte, index) => prefix[index] === byte);
          const ascii = new TextDecoder().decode(prefix);
          const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
          const valid =
            kind === 'pdf'
              ? ascii.startsWith('%PDF-')
              : extension === 'png'
                ? starts(137, 80, 78, 71, 13, 10, 26, 10)
                : ['jpg', 'jpeg'].includes(extension)
                  ? starts(255, 216, 255)
                  : extension === 'gif'
                    ? /^(GIF87a|GIF89a)/.test(ascii)
                    : extension === 'webp'
                      ? ascii.startsWith('RIFF') &&
                        ascii.slice(8, 12) === 'WEBP'
                      : extension === 'bmp'
                        ? ascii.startsWith('BM')
                        : extension === 'avif'
                          ? ascii.slice(4, 8) === 'ftyp' &&
                            ['avif', 'avis'].includes(ascii.slice(8, 12))
                          : false;
          if (!valid) throw new Error('Unsupported preview content');
          if (!active) return;
          url = URL.createObjectURL(
            new Blob([blob], {
              type: kind === 'pdf' ? 'application/pdf' : imageTypes[extension],
            })
          );
          if (active) setObjectUrl(url);
        }
      } catch {
        if (active) setError(String(t('client_library_preview_unavailable')));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, file.name, file.size, kind, t]);
  return (
    <Modal
      visible
      onClose={onClose}
      title={<span className="break-all">{file.name}</span>}
      size="large"
    >
      {loading && <p role="status">{t('loading')}</p>}
      {error && <p role="alert">{error}</p>}
      {kind === 'image' && objectUrl && !error && (
        <img
          src={objectUrl}
          alt={file.name}
          onError={() =>
            setError(String(t('client_library_preview_unavailable')))
          }
          className="max-w-full object-contain mx-auto"
          style={{ maxHeight: '65vh' }}
        />
      )}
      {kind === 'pdf' && objectUrl && (
        <iframe
          src={objectUrl}
          title={file.name}
          className="w-full border-0"
          style={{ height: '65vh' }}
        />
      )}
      {kind === 'text' && !loading && !error && (
        <pre
          className="overflow-auto rounded border p-4 font-mono text-sm"
          style={{ maxHeight: '65vh', tabSize: 4 }}
        >
          <code>{content}</code>
        </pre>
      )}
      <div className="flex flex-wrap justify-end items-center gap-2">
        {kind === 'pdf' && objectUrl && (
          <a
            href={objectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline mr-2"
          >
            {t('open_in_new_tab')}
          </a>
        )}
        <Button behavior="button" type="secondary" onClick={onClose}>
          {t('close')}
        </Button>
        <Button behavior="button" onClick={onDownload}>
          {t('download')}
        </Button>
      </div>
    </Modal>
  );
}
