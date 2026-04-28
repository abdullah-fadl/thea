/**
 * React Query Hook for Departments (Patient Experience)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/keys';
import { FloorDepartment } from '@/lib/models/Floor';

async function fetchAllDepartments(): Promise<FloorDepartment[]> {
  const response = await fetch('/api/structure/departments', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch departments');
  }
  
  const data = await response.json();
  return data.data || [];
}

async function fetchDepartmentsByFloor(floorKey: string): Promise<FloorDepartment[]> {
  const response = await fetch(`/api/structure/departments?floorKey=${floorKey}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch departments');
  }
  
  const data = await response.json();
  return data.data || [];
}

async function createDepartmentMutation(data: {
  floorId: string;
  floorKey: string;
  departmentKey: string;
  departmentName?: string;
  label_en: string;
  label_ar: string;
}): Promise<FloorDepartment> {
  const response = await fetch('/api/structure/departments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create department');
  }
  
  const result = await response.json();
  return result.data;
}

async function updateDepartmentMutation({
  id,
  ...data
}: {
  id: string;
  floorKey?: string;
  departmentKey?: string;
  departmentName?: string;
  label_en?: string;
  label_ar?: string;
}): Promise<FloorDepartment> {
  const response = await fetch(`/api/structure/departments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update department');
  }
  
  const result = await response.json();
  return result.data;
}

async function deleteDepartmentMutation(id: string): Promise<void> {
  const response = await fetch(`/api/structure/departments/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete department');
  }
}

export function useAllDepartments() {
  return useQuery({
    queryKey: queryKeys.departments.list(),
    queryFn: fetchAllDepartments,
  });
}

export function useDepartmentsByFloor(floorKey: string | null) {
  return useQuery({
    queryKey: queryKeys.departments.list({ floorKey }),
    queryFn: () => fetchDepartmentsByFloor(floorKey!),
    enabled: !!floorKey,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createDepartmentMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateDepartmentMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteDepartmentMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}


