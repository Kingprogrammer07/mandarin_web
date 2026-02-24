import React from 'react';
import { Search, ReceiptText, PackageOpen, UserCircle } from 'lucide-react';
import { FloatingNavbar, type FloatingNavItem } from './FloatingNavbar';

// Page types definition
export type Page =
  | 'login'
  | 'register'
  | 'import'
  | 'client-add'
  | 'client-edit'
  | 'flights'
  | 'cargo-list'
  | 'cargo-add'
  | 'statistics'
  | 'verification-search'
  | 'verification-profile'
  | 'verification-transactions'
  | 'verification-unpaid'
  | 'user-profile';

interface VerificationNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  clientCode?: string;
  clientId?: number;
}

export const VerificationNav: React.FC<VerificationNavProps> = ({
  currentPage,
  onNavigate,
  clientCode,
}) => {
  const navItems: FloatingNavItem<Page>[] = [
    {
      id: 'search',
      label: 'Qidiruv',
      icon: Search,
      page: 'verification-search',
    },
    {
      id: 'profile',
      label: 'Profil',
      icon: UserCircle,
      page: 'verification-profile',
      disabled: !clientCode,
    },
    {
      id: 'transactions',
      label: 'Tranzaksiyalar',
      icon: ReceiptText,
      page: 'verification-transactions',
      disabled: !clientCode,
    },
    {
      id: 'unpaid',
      label: 'To\'lanmagan',
      icon: PackageOpen,
      page: 'verification-unpaid',
      disabled: !clientCode,
    },
  ];

  return (
    <FloatingNavbar
      items={navItems}
      activePage={currentPage}
      onNavigate={onNavigate}
    />
  );
};
