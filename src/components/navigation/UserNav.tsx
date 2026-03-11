import React from 'react';
import { Home, FileText, History, UserCircle } from 'lucide-react';
import { FloatingNavbar, type FloatingNavItem } from './FloatingNavbar';
import { useTranslation } from 'react-i18next';

// Reuse Page type from VerificationNav for now, or ideally from a shared type file
// We need to extend it for user pages if they are not there
export type UserPageType =
    | 'user-home'
    | 'user-reports'
    | 'user-history'
    | 'user-profile';

// We can also accept any string if generic
// But for strict typing let's assume we pass a generic type or compatible string

interface UserNavProps {
    currentPage: string; // Using string to be flexible with App.tsx Page type
    onNavigate: (page: string) => void;
}

export const UserNav: React.FC<UserNavProps> = ({
    currentPage,
    onNavigate
}) => {
    const { t } = useTranslation();
    const navItems: FloatingNavItem<string>[] = [
        {
            id: 'home',
            label: t('navigation.home'),
            icon: Home,
            page: 'user-home',
        },
        {
            id: 'reports',
            label: t('navigation.reports'),
            icon: FileText,
            page: 'user-reports',
        },
        {
            id: 'history',
            label: t('navigation.history'),
            icon: History,
            page: 'user-history',
        },
        {
            id: 'profile',
            label: t('navigation.profile'),
            icon: UserCircle,
            page: 'user-profile',
        },
    ];

    const handleNavigate = (page: string) => {
        onNavigate(page);
    };

    const desktopBottomPages = ['user-profile', 'user-reports', 'user-history', 'user-home'];
    const desktopPosition = desktopBottomPages.includes(currentPage) ? 'bottom' : 'top';

    return (
        <FloatingNavbar<string>
            items={navItems}
            activePage={currentPage}
            onNavigate={handleNavigate}
            className="mb-6 md:mb-0"
            desktopPosition={desktopPosition}
        />
    );
};
