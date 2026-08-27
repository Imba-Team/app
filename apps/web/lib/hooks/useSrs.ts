import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getSrsForecast,
  getSrsQueueToday,
  reviewSrsCard,
  type SrsRating,
} from "@/lib/api";

export const srsKeys = {
  all: ["srs"] as const,
  queue: (limit: number, offset: number) =>
    [...srsKeys.all, "queue", { limit, offset }] as const,
  forecast: (days: number) =>
    [...srsKeys.all, "forecast", { days }] as const,
};

export function useSrsQueue(limit = 50, offset = 0) {
  return useQuery({
    queryKey: srsKeys.queue(limit, offset),
    queryFn: () => getSrsQueueToday(limit, offset),
  });
}

export function useSrsForecast(days = 30) {
  return useQuery({
    queryKey: srsKeys.forecast(days),
    queryFn: () => getSrsForecast(days),
  });
}

interface ReviewArgs {
  srsCardId: string;
  attemptId: string;
  rating: SrsRating;
}

export function useReviewSrsCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ srsCardId, attemptId, rating }: ReviewArgs) =>
      reviewSrsCard(srsCardId, attemptId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srsKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit review");
    },
  });
}
