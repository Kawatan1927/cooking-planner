import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PropsWithChildren, ReactElement } from 'react';

interface ProviderOptions {
  route?: string;
  queryClient?: QueryClient;
}

type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & ProviderOptions;

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function createTestWrapper({
  route = '/',
  queryClient = createTestQueryClient(),
}: ProviderOptions = {}) {
  return function TestWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  { route, queryClient = createTestQueryClient(), ...options }: RenderWithProvidersOptions = {}
) {
  return {
    queryClient,
    ...render(ui, { wrapper: createTestWrapper({ route, queryClient }), ...options }),
  };
}
