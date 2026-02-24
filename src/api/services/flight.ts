import { apiClient } from '../client';

export interface Flight {
  name: string;  // Flight name from Google Sheets (e.g., M123-2025)
}

export interface FlightListResponse {
  flights: Flight[];
  total: number;
}

export interface ClientCargoData {
  flight: string;
  client_code: string;
  row_number: number;
  track_codes: string[];
  weight_kg: string | null;
  price_per_kg: string | null;
  total_payment: string | null;
  payment_status: string | null;
}

export interface FlightClientsResponse {
  flight: string;
  clients: ClientCargoData[];
  total: number;
}

// Get all flights from Google Sheets
export const getFlights = async (lastN: number = 5): Promise<FlightListResponse> => {
  const response = await apiClient.get<FlightListResponse>('/api/v1/flights', {
    params: { last_n: lastN }
  });
  return response.data;
};

// Get flight by name (returns the same name since flights are just worksheet names)
export const getFlightByName = async (name: string): Promise<Flight> => {
  return { name };
};

