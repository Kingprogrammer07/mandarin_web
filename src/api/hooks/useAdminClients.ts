import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateClientPersonalFormValues } from "../../schemas/clientSchemas";
import type { GetClientFinancesParams, SearchClientsParams } from "../services/adminClients";
import {
  searchClientsPaginated,
  getClientDetail,
  updateClientPersonal,
  getClientFinances,
  getTransactionPaymentDetail,
  getClientFlights,
} from "../services/adminClients";

export const useClientsList = (params: SearchClientsParams) => {
  const hasQuery =
    (params.code?.trim().length ?? 0) > 0 ||
    (params.name?.trim().length ?? 0) > 0 ||
    (params.q?.trim().length ?? 0) > 0;

  return useQuery({
    queryKey: ["admin_clients_list", params],
    queryFn: () => searchClientsPaginated(params),
    enabled: hasQuery,
    placeholderData: (previousData) => previousData,
  });
};

export const useClientDetail = (clientId: number | null) => {
  return useQuery({
    queryKey: ["admin_client_detail", clientId],
    queryFn: () => getClientDetail(clientId as number),
    enabled: !!clientId,
  });
};

export const useClientFinances = (
  clientId: number | null,
  params: GetClientFinancesParams = {},
) => {
  return useQuery({
    queryKey: ["admin_client_finances", clientId, params],
    queryFn: () => getClientFinances(clientId as number, params),
    enabled: !!clientId,
    placeholderData: (previousData) => previousData,
  });
};

export const useTransactionPaymentDetail = (
  clientId: number | null,
  transactionId: number | null,
) => {
  return useQuery({
    queryKey: ["admin_transaction_payment_detail", clientId, transactionId],
    queryFn: () =>
      getTransactionPaymentDetail(clientId as number, transactionId as number),
    enabled: !!clientId && !!transactionId,
  });
};

export const useClientFlights = (clientId: number | null) => {
  return useQuery({
    queryKey: ["admin_client_flights", clientId],
    queryFn: () => getClientFlights(clientId as number),
    enabled: !!clientId,
  });
};

export const useUpdateClientPersonal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number;
      data: UpdateClientPersonalFormValues;
    }) => updateClientPersonal(clientId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin_client_detail", variables.clientId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin_clients_list"] });
    },
  });
};
