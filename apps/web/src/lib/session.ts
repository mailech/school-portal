'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CurrentUser, LoginDto, LoginResponse } from '@app/types';
import { api } from './api';

export function useSession() {
  return useQuery<{ user: CurrentUser }>({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: CurrentUser }>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: LoginDto) => api.post<LoginResponse>('/auth/login', dto),
    onSuccess: (data) => qc.setQueryData(['me'], { user: data.user }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => qc.clear(),
  });
}

export function isAdmin(user?: CurrentUser | null): boolean {
  return user?.role === 'ADMIN';
}
