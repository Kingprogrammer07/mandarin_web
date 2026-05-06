import Dashboard from "./Dashboard";

interface UserHomeProps {
  onNavigateToReports?: () => void;
  onNavigateToHistory?: () => void;
}

export default function UserHome({ onNavigateToReports, onNavigateToHistory }: UserHomeProps) {
  return (
    <Dashboard
      onNavigateToReports={onNavigateToReports}
      onNavigateToHistory={onNavigateToHistory}
    />
  );
}
