import Dashboard from "./Dashboard";

interface UserHomeProps {
  onNavigateToReports?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToReferral?: () => void;
}

export default function UserHome({
  onNavigateToReports,
  onNavigateToHistory,
  onNavigateToReferral,
}: UserHomeProps) {
  return (
    <Dashboard
      onNavigateToReports={onNavigateToReports}
      onNavigateToHistory={onNavigateToHistory}
      onNavigateToReferral={onNavigateToReferral}
    />
  );
}
