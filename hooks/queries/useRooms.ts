/**
 * React Query Hook for Rooms (Patient Experience)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/keys';
import { FloorRoom } from '@/lib/models/Floor';

async function fetchRoomsByFloorAndDepartment(
  floorKey: string,
  departmentKey: string
): Promise<FloorRoom[]> {
  const response = await fetch(
    `/api/structure/rooms?floorKey=${floorKey}&departmentKey=${departmentKey}`,
    {
      credentials: 'include',
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch rooms');
  }
  
  const data = await response.json();
  return data.data || [];
}

async function createRoomMutation(data: {
  floorId: string;
  floorKey: string;
  departmentId: string;
  departmentKey: string;
  roomNumber: string;
  roomName?: string;
  label_en: string;
  label_ar: string;
}): Promise<FloorRoom> {
  const response = await fetch('/api/structure/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create room');
  }
  
  const result = await response.json();
  return result.data;
}

async function updateRoomMutation({
  id,
  ...data
}: {
  id: string;
  floorKey?: string;
  departmentKey?: string;
  roomNumber?: string;
  roomName?: string;
  label_en?: string;
  label_ar?: string;
}): Promise<FloorRoom> {
  const response = await fetch(`/api/structure/rooms/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update room');
  }
  
  const result = await response.json();
  return result.data;
}

async function deleteRoomMutation(id: string): Promise<void> {
  const response = await fetch(`/api/structure/rooms/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete room');
  }
}

export function useRoomsByFloorAndDepartment(
  floorKey: string | null,
  departmentKey: string | null
) {
  return useQuery({
    queryKey: queryKeys.rooms.list({ floorKey, departmentKey }),
    queryFn: () => fetchRoomsByFloorAndDepartment(floorKey!, departmentKey!),
    enabled: !!floorKey && !!departmentKey,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createRoomMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateRoomMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteRoomMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}


