/**
 * React Query Hook for Floors
 * 
 * Provides unified data fetching and caching for Floor entities.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/keys';
import { Floor } from '@/lib/models/Floor';

// Fetch functions
async function fetchFloors(): Promise<Floor[]> {
  const response = await fetch('/api/structure/floors', {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch floors');
  }
  
  const data = await response.json();
  return data.data || [];
}

async function createFloorMutation(data: {
  number: string;
  name?: string;
  label_en: string;
  label_ar: string;
}): Promise<Floor> {
  const response = await fetch('/api/structure/floors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create floor');
  }
  
  const result = await response.json();
  return result.data;
}

async function updateFloorMutation({
  id,
  ...data
}: {
  id: string;
  number?: string;
  name?: string;
  label_en?: string;
  label_ar?: string;
}): Promise<Floor> {
  const response = await fetch(`/api/structure/floors/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update floor');
  }
  
  const result = await response.json();
  return result.data;
}

async function deleteFloorMutation(id: string): Promise<void> {
  const response = await fetch(`/api/structure/floors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete floor');
  }
}

// Hooks
export function useFloors() {
  return useQuery({
    queryKey: queryKeys.floors.list(),
    queryFn: fetchFloors,
  });
}

export function useCreateFloor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createFloorMutation,
    onSuccess: () => {
      // Invalidate floors list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.floors.all });
      // Also invalidate departments and rooms since they depend on floors
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useUpdateFloor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateFloorMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.floors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useDeleteFloor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteFloorMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.floors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}


