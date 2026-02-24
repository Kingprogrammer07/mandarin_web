import { useState, useEffect } from 'react';
import { getFlights, type Flight } from '@/api/services/flight';
import { ChevronDown, ChevronRight, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface FlightsPageProps {
  onSelectFlight: (flightName: string) => void;
}

export default function FlightsPage({ onSelectFlight }: FlightsPageProps) {
  const { t } = useTranslation();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOldFlights, setShowOldFlights] = useState(false);

  useEffect(() => {
    loadFlights();
  }, []);

  const loadFlights = async () => {
    try {
      setIsLoading(true);
      const data = await getFlights(5); // Get last 5 flights
      setFlights(data.flights.reverse());
    } catch (error) {
      console.error('Failed to load flights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Oxirgi 3 ta reys (expanded by default)
  const recentFlights = flights.slice(0, 3);
  // Oldingi reyslar (collapsed by default)
  const oldFlights = flights.slice(3);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('flights.title')}</h1>
        <p className="text-gray-600">{t('flights.subtitle')}</p>
      </div>

      {/* Oxirgi 3 ta reys - expanded */}
      <div className="space-y-3 mb-6">
        {recentFlights.map((flight) => (
          <FlightCard
            key={flight.name}
            flight={flight}
            onSelect={() => onSelectFlight(flight.name)}
          />
        ))}
      </div>

      {/* Oldingi reyslar - collapsible */}
      {oldFlights.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowOldFlights(!showOldFlights)}
            className="flex items-center gap-2 text-gray-700 hover:text-orange-600 transition-colors mb-3 font-medium"
          >
            {showOldFlights ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
            {t('flights.oldFlights')} ({oldFlights.length})
          </button>

          {showOldFlights && (
            <div className="space-y-3">
              {oldFlights.map((flight) => (
                <FlightCard
                  key={flight.name}
                  flight={flight}
                  onSelect={() => onSelectFlight(flight.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {flights.length === 0 && (
        <div className="text-center py-12">
          <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">{t('flights.noFlights')}</p>
        </div>
      )}
    </div>
  );
}

interface FlightCardProps {
  flight: Flight;
  onSelect: () => void;
}

function FlightCard({ flight, onSelect }: FlightCardProps) {
  const { t } = useTranslation();

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-orange-400 overflow-hidden group"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">
                {flight.name}
              </h3>
              <p className="text-sm text-gray-600">
                {t('flights.fromGoogleSheets')}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 transition-colors"
          >
            {t('flights.selectFlight')}
          </Button>
        </div>
      </div>
    </div>
  );
}
