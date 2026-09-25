"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import type { MemberInput, TaskInput } from "./types";

const TASKS_KEY = ["ignite", "tasks"];
const MEMBERS_KEY = ["ignite", "members"];

// The club is small, so every view loads all tasks once and filters locally.
// Polling keeps shared screens fresh while several members edit at once.
export function useIgniteTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => api.ignite.listTasks(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useIgniteMembers() {
  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: () => api.ignite.listMembers(true),
  });
}

function useOnError() {
  const { toast } = useToast();
  return (error: unknown) =>
    toast({
      title: "Something went wrong",
      description: error instanceof Error ? error.message : "Please try again",
      variant: "destructive",
    });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const onError = useOnError();
  const onSuccess = () => qc.invalidateQueries({ queryKey: TASKS_KEY });

  return {
    create: useMutation({
      mutationFn: (data: TaskInput) => api.ignite.createTask(data),
      onSuccess,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: TaskInput }) =>
        api.ignite.updateTask(id, data),
      onSuccess,
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.ignite.deleteTask(id),
      onSuccess,
      onError,
    }),
  };
}

export function useMemberMutations() {
  const qc = useQueryClient();
  const onError = useOnError();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: MEMBERS_KEY });
    qc.invalidateQueries({ queryKey: TASKS_KEY });
  };
  return {
    create: useMutation({
      mutationFn: (data: MemberInput) => api.ignite.createMember(data),
      onSuccess,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: MemberInput }) => api.ignite.updateMember(id, data),
      onSuccess,
      onError,
    }),
  };
}
