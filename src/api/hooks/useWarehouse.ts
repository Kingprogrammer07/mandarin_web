import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getWarehouseFlights,
  getFlightTransactions,
  markTransactionTaken,
  getMyActivity,
  searchTransactions,
  searchTransactionsGrouped,
} from "../services/warehouse";
import type { GetFlightTransactionsParams, SearchTransactionsParams } from "../services/warehouse";

/** Query key factory for warehouse queries. */
export const warehouseKeys = {
  flights: () => ["warehouse_flights"] as const,
  transactions: (flightName: string, params: GetFlightTransactionsParams) =>
    ["warehouse_transactions", flightName, params] as const,
  allTransactions: () => ["warehouse_transactions"] as const,
  transactionSearch: (params: SearchTransactionsParams) =>
    ["warehouse_transaction_search", params] as const,
  groupedTransactionSearch: (params: SearchTransactionsParams) =>
    ["warehouse_grouped_transaction_search", params] as const,
  myActivity: (page: number, size: number) =>
    ["warehouse_my_activity", page, size] as const,
};

/** Fetches the list of recent warehouse flights for the flight selector. */
export const useWarehouseFlights = () => {
  return useQuery({
    queryKey: warehouseKeys.flights(),
    queryFn: () => getWarehouseFlights(20),
    staleTime: 60_000, // 1 min — flight list doesn't change often
  });
};

/**
 * Fetches paginated flight transactions with filters.
 * Enabled only when `flightName` is non-empty.
 */
export const useWarehouseTransactions = (
  flightName: string,
  params: GetFlightTransactionsParams,
) => {
  return useQuery({
    queryKey: warehouseKeys.transactions(flightName, params),
    queryFn: () => getFlightTransactions(flightName, params),
    enabled: flightName.trim().length > 0,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Searches transactions across all flights (no flight required).
 * Enabled only when at least one search term exists and no flight is selected.
 */
export const useWarehouseTransactionSearch = (
  params: SearchTransactionsParams,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: warehouseKeys.transactionSearch(params),
    queryFn: () => searchTransactions(params),
    enabled,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Searches transactions grouped by client and flight.
 */
export const useGroupedWarehouseSearch = (
  params: SearchTransactionsParams,
  enabled: boolean,
) => {
  return useQuery({
    queryKey: warehouseKeys.groupedTransactionSearch(params),
    queryFn: () => searchTransactionsGrouped(params),
    enabled,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Mutation to mark a transaction as taken.
 * On success, invalidates all warehouse transaction queries and shows a toast.
 */
export const useMarkTaken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      data,
    }: {
      transactionId: number;
      data: FormData;
    }) => markTransactionTaken(transactionId, data),
    onSuccess: (res) => {
      toast.success(res.message || "Yuk muvaffaqiyatli olib ketildi deb belgilandi");
      queryClient.invalidateQueries({
        queryKey: warehouseKeys.allTransactions(),
      });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e.message ?? "Belgilashda xatolik yuz berdi");
    },
  });
};

/**
 * Fetches the current warehouse worker's mark-taken activity log.
 */
export const useMyActivity = (page: number, size: number) => {
  return useQuery({
    queryKey: warehouseKeys.myActivity(page, size),
    queryFn: () => getMyActivity(page, size),
    placeholderData: (previousData) => previousData,
  });
};
