import { TermProgress } from "@/app/modules/[id]/types";
import { apiClient } from "./axios";
import { AxiosError } from "axios";

// ============================================
// MODULES API
// ============================================

export interface Module {
  id: string;
  slug: string;
  title: string;
  description: string;
  isPrivate: boolean;
  userId: string;
  isOwner: boolean;
}

export interface CommunityModule extends Module {
  ownerName: string;
  ownerImg?: string;
  termsCount: number;
}

export interface CreateModuleData {
  title: string;
  description: string;
  isPrivate: boolean;
}

export interface UpdateModuleData {
  title?: string;
  description?: string;
  isPrivate?: boolean;
}

export async function getModules() {
  try {
    const { data } = await apiClient.get("/v2/modules/collection");
    if (!data.ok) throw new Error(data.message || "Failed to fetch modules");
    return data.data as Module[];
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to fetch modules"
    );
  }
}

export async function getCommunityModules(q?: string) {
  try {
    const { data } = await apiClient.get("/v2/modules/public", {
      params: q ? { q } : undefined,
    });
    if (!data.ok)
      throw new Error(data.message || "Failed to fetch community modules");
    return data.data as CommunityModule[];
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to fetch community modules"
    );
  }
}

export async function getModuleById(id: string) {
  try {
    const { data } = await apiClient.get(`/v2/modules/${id}`);
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to fetch module"
    );
  }
}

export async function createModule(moduleData: CreateModuleData) {
  try {
    const { data } = await apiClient.post("/v2/modules", moduleData);
    if (!data.ok) throw new Error(data.message || "Failed to create module");
    return data.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to create module"
    );
  }
}

export async function updateModule(id: string, moduleData: UpdateModuleData) {
  try {
    const { data } = await apiClient.patch(`/v2/modules/${id}`, moduleData);
    if (!data.ok) throw new Error(data.message || "Failed to update module");
    return data.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to update module"
    );
  }
}

export async function deleteModule(id: string) {
  try {
    const { data } = await apiClient.delete(`/modules/${id}`);
    if (!data.ok) throw new Error(data.message || "Failed to delete module");
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to delete module"
    );
  }
}

export async function collectModule(id: string) {
  try {
    const { data } = await apiClient.post(`/v2/modules/${id}/collect`);
    if (!data.ok) throw new Error(data.message || "Failed to collect module");
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to collect module"
    );
  }
}

export async function uncollectModule(id: string) {
  try {
    const { data } = await apiClient.post(`/v2/modules/${id}/uncollect`);
    if (!data.ok) throw new Error(data.message || "Failed to uncollect module");
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to uncollect module"
    );
  }
}

// ============================================
// TERMS API
// ============================================

export interface Term {
  id: string;
  term: string;
  definition: string;
  moduleId: string;
  isStarred: boolean;
}

export interface CreateTermData {
  term: string;
  definition: string;
  moduleId: string;
  isStarred: boolean;
}

export interface UpdateTermData {
  term?: string;
  definition?: string;
  isStarred?: boolean;
}

export async function getTermsByModuleId(moduleId: string) {
  try {
    const { data } = await apiClient.get(`/terms`, { params: { moduleId } });
    return data.data?.data || [];
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to fetch terms"
    );
  }
}

export async function createTerm(termData: CreateTermData) {
  try {
    const { data } = await apiClient.post("/terms", termData);
    return data.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to create term"
    );
  }
}

export async function updateTerm(id: string, termData: UpdateTermData) {
  try {
    const { data } = await apiClient.patch(`/terms/${id}`, termData);
    return data.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to update term"
    );
  }
}

export async function deleteTerm(id: string) {
  try {
    await apiClient.delete(`/terms/${id}`);
    return { success: true };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to delete term"
    );
  }
}

// ============================================
// TERM PROGRESS API
// ============================================

export async function getTermProgress(id: string) {
  try {
    const { data } = await apiClient.get(`/v2/terms/${id}/progress`);
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to fetch term progress"
    );
  }
}

export async function updateTermProgress(
  id: string,
  termData: { status?: TermProgress["status"]; isStarred?: boolean }
) {
  try {
    const { data } = await apiClient.patch(`/v2/terms/${id}/progress`, {
      status: termData.status,
      isStarred: termData.isStarred,
    });

    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to update term progress"
    );
  }
}

export async function updateTermStatus(id: string, success: boolean) {
  try {
    // TODO: change to PATCH method on backend
    const { data } = await apiClient.post(`/v2/terms/${id}/update-status`, {
      success,
    });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new Error(
      axiosError.response?.data?.message || "Failed to update term progress"
    );
  }
}
