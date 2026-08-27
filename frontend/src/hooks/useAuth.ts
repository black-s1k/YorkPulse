"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { User } from "@/types";

export function useUser() {
  const { isAuthenticated, setUser } = useAuthStore();

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const user = await api.auth.me();
      setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, hp }: { email: string; hp?: string }) =>
      api.auth.login(email, hp),
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: ({ email, hp }: { email: string; hp?: string }) =>
      api.auth.signup(email, hp),
  });
}

export function useVerifyEmail() {
  const { setTokens } = useAuthStore();

  return useMutation({
    mutationFn: (token: string) => api.auth.verifyEmail(token),
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token);
    },
  });
}

export function useVerifyOTP() {
  const { setTokens } = useAuthStore();

  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      api.auth.verifyOTP(email, code),
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token);
    },
  });
}

export function useResendOTP() {
  return useMutation({
    mutationFn: ({ email, hp }: { email: string; hp?: string }) =>
      api.auth.resendOTP(email, hp),
  });
}

export function useVerifyName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.auth.verifyName(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useVerifyId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageUrl, providedName }: { imageUrl: string; providedName: string }) =>
      api.auth.verifyId(imageUrl, providedName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: (data: Partial<User>) => api.auth.updateProfile(data),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(["user", "me"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const router = useRouter();

  return () => {
    logout();
    queryClient.clear();
    router.push("/");
  };
}
