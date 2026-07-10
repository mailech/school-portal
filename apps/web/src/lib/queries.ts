'use client';

import { useQuery } from '@tanstack/react-query';
import type { AcademicYearView, SchoolClassView } from '@app/types';
import { api } from './api';

export function useAcademicYears() {
  return useQuery<AcademicYearView[]>({
    queryKey: ['academic-years'],
    queryFn: () => api.get<AcademicYearView[]>('/academic-years'),
  });
}

export function useClasses(academicYearId?: string) {
  return useQuery<SchoolClassView[]>({
    queryKey: ['classes', academicYearId ?? 'all'],
    queryFn: () =>
      api.get<SchoolClassView[]>('/classes' + (academicYearId ? `?academicYearId=${academicYearId}` : '')),
  });
}
