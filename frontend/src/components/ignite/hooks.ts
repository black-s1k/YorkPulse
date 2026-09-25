"use client";

import { useCallback, useSyncExternalStore } from "react";
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
  const { actingAs } = useActingAs();
  const actor = actingAs?.name ?? null;
  const onSuccess = () => qc.invalidateQueries({ queryKey: TASKS_KEY });

  return {
    create: useMutation({
      mutationFn: (data: TaskInput) => api.ignite.createTask({ ...data, actor }),
      onSuccess,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: TaskInput }) =>
        api.ignite.updateTask(id, { ...data, actor }),
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

// "Who am I" on this device. The club shares one login, so this is how a
// change gets credited to a person. Per-device only, so localStorage is fine.
const ACTING_AS_KEY = "ignite-acting-as";
const listeners = new Set<() => void>();

function readActingAs(): string | null {
  try {
    return localStorage.getItem(ACTING_AS_KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useActingAs() {
  const raw = useSyncExternalStore(subscribe, readActingAs, () => null);
  let actingAs: { id: string; name: string } | null = null;
  try {
    actingAs = raw ? JSON.parse(raw) : null;
  } catch {
    actingAs = null;
  }

  const setActingAs = useCallback((member: { id: string; name: string } | null) => {
    try {
      if (member) localStorage.setItem(ACTING_AS_KEY, JSON.stringify({ id: member.id, name: member.name }));
      else localStorage.removeItem(ACTING_AS_KEY);
    } catch {
      // storage unavailable: the choice just won't persist
    }
    listeners.forEach((l) => l());
  }, []);

  return { actingAs, setActingAs };
}
