import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import english from '../../../src/resources/lang/en/en.json';

const state = vi.hoisted(() => ({
  admin: true,
  catalog: undefined as any,
  queries: [] as any[],
  request: vi.fn(),
  invalidate: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => {
    state.queries.push(options);
    return options.queryKey[0] === 'client-folder-catalog'
      ? { data: state.catalog, isError: false }
      : {
          data: {
            enabled: true,
            folder: 'Current folder',
            library_url: null,
            privacy_review_count: 0,
            pending_migrations: 0,
          },
          refetch: state.refetch,
        };
  },
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: keyof typeof english, values: Record<string, string> = {}) =>
      String(english[key] ?? key).replace(
        /{{(\w+)}}/g,
        (_, name) => values[name] ?? ''
      ),
  ],
}));
vi.mock('$app/common/helpers', () => ({
  endpoint: (path: string, values: { id?: string } = {}) =>
    path.replace(':id', values.id ?? ''),
}));
vi.mock('$app/common/helpers/request', () => ({ request: state.request }));
vi.mock('$app/common/hooks/permissions/useHasPermission', () => ({
  useAdmin: () => ({ isAdmin: state.admin, isOwner: false }),
}));
vi.mock('$app/common/hooks/useCurrentCompany', () => ({
  useCurrentCompany: () => ({ id: 'company1' }),
}));
vi.mock('$app/common/hooks/useRefetch', () => ({ $refetch: vi.fn() }));
vi.mock('$app/components/cards', () => ({
  Card: ({ children }: any) => createElement('section', {}, children),
  CardContainer: ({ children }: any) => createElement('div', {}, children),
}));
vi.mock('$app/components/forms', () => ({
  SelectField: (props: any) =>
    createElement(
      'select',
      {
        value: props.value,
        disabled: props.disabled,
        onChange: (event: any) => props.onValueChange(event.target.value),
      },
      props.children
    ),
  Button: (props: any) =>
    createElement(
      'button',
      { disabled: props.disabled, onClick: props.onClick },
      props.children
    ),
}));
vi.mock(
  '../../../src/pages/clients/common/components/ClientFolderManager',
  () => ({ ClientFolderManager: () => null })
);
vi.mock('../../../src/pages/clients/common/components/DocumentLibrary', () => ({
  DocumentLibrary: () => null,
}));

import { ClientFileLibrary } from '../../../src/pages/clients/common/components/ClientFileLibrary';

describe('per-client full folder catalog', () => {
  let renderer: ReactTestRenderer;
  beforeEach(() => {
    state.admin = true;
    state.queries = [];
    state.catalog = {
      enabled: true,
      data: [
        {
          folder: 'Current folder',
          client_id: 'client1',
          client_name: 'Current client',
        },
        {
          folder: 'Other folder',
          client_id: 'client2',
          client_name: 'Other client',
        },
        { folder: 'Unassigned folder', client_id: null, client_name: null },
        {
          folder: 'Foreign folder',
          client_id: null,
          client_name: null,
          assigned_to_other_company: true,
        },
      ],
    };
    state.request.mockReset().mockResolvedValue({ data: state.catalog });
    state.invalidate.mockReset().mockResolvedValue(undefined);
    state.refetch.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });
  const mount = () =>
    act(() => {
      renderer = create(
        createElement(ClientFileLibrary, { clientId: 'client1' })
      );
    });
  const select = (folder: string) =>
    act(() =>
      renderer.root
        .findByType('select')
        .props.onChange({ target: { value: folder } })
    );

  test('loads the shared admin catalog and includes already assigned folders with ownership', async () => {
    mount();
    const query = state.queries.find(
      (options) => options.queryKey[0] === 'client-folder-catalog'
    );
    expect(query.queryKey).toEqual(['client-folder-catalog', 'company1']);
    expect(query.enabled).toBe(true);
    await query.queryFn();
    expect(state.request).toHaveBeenCalledWith(
      'GET',
      '/api/v1/client-file-folders'
    );
    const options = renderer.root.findAllByType('option');
    expect(options).toHaveLength(4);
    expect(options[0].children.join('')).toContain('This client');
    expect(options[1].children.join('')).toContain(
      'Assigned to Other client — transfer on save'
    );
    expect(options[2].children.join('')).toContain('Unassigned');
    expect(options[3].props.disabled).toBe(true);
  });

  test('explains a transfer before saving and uses the existing metadata endpoint', async () => {
    mount();
    select('Other folder');
    expect(
      renderer.root.findByProps({ role: 'status' }).children.join('')
    ).toContain('Saving transfers this folder from Other client');
    const save = renderer.root
      .findAllByType('button')
      .find((button) => button.children.join('') === 'Save')!;
    await act(async () => save.props.onClick());
    expect(state.request).toHaveBeenCalledOnce();
    expect(state.request).toHaveBeenCalledWith(
      'PUT',
      '/api/v1/clients/client1/file-library',
      { folder: 'Other folder' }
    );
    expect(state.invalidate).toHaveBeenCalledWith({
      queryKey: ['client-file-library'],
    });
    expect(state.invalidate).toHaveBeenCalledWith({
      queryKey: ['document-library'],
    });
  });

  test('does not show transfer information for current or unassigned folders', () => {
    mount();
    expect(renderer.root.findAllByProps({ role: 'status' })).toHaveLength(0);
    select('Unassigned folder');
    expect(renderer.root.findAllByProps({ role: 'status' })).toHaveLength(0);
  });

  test('keeps other-company folders disabled and unsavable', () => {
    mount();
    select('Foreign folder');
    const save = renderer.root
      .findAllByType('button')
      .find((button) => button.children.join('') === 'Save')!;
    expect(save.props.disabled).toBe(true);
    expect(renderer.root.findAllByProps({ role: 'status' })).toHaveLength(0);
  });

  test('non-admins retain only their current folder and cannot load or edit the catalog', () => {
    state.admin = false;
    mount();
    const query = state.queries.find(
      (options) => options.queryKey[0] === 'client-folder-catalog'
    );
    expect(query.enabled).toBe(false);
    expect(renderer.root.findAllByType('option')).toHaveLength(1);
    expect(renderer.root.findByType('select').props.value).toBe(
      'Current folder'
    );
    expect(renderer.root.findByType('select').props.disabled).toBe(true);
    expect(renderer.root.findAllByType('button')).toHaveLength(0);
  });
});
