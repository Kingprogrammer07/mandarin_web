import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateProfile } from '@/hooks/useProfile';
import { type ProfileResponse, type UpdateProfileRequest } from '@/types/profile';
import { Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { regions, DISTRICTS } from '@/lib/validation';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: ProfileResponse;
}

type EditProfileFormData = Required<Pick<UpdateProfileRequest, 'full_name' | 'phone' | 'region' | 'district' | 'address'>>;

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

export const EditProfileModal = ({ isOpen, onClose, user }: EditProfileModalProps) => {
    const { mutate, isPending } = useUpdateProfile();
    const { t } = useTranslation();

    const [formData, setFormData] = useState<EditProfileFormData>({
        full_name: '',
        phone: '',
        address: '',
        region: '',
        district: ''
    });

    const resolveRegionValue = (value?: string | null) => {
        const normalized = normalizeText(value);
        if (!normalized) return '';

        return regions.find((region) => {
            return [region.value, region.label, t(region.label)].some((candidate) => normalizeText(candidate) === normalized);
        })?.value ?? '';
    };

    const resolveDistrictValue = (regionValue: string, value?: string | null) => {
        const normalized = normalizeText(value);
        if (!regionValue || !normalized) return '';

        return (DISTRICTS[regionValue] ?? []).find((district) => {
            return [district.value, district.label, t(district.label)].some((candidate) => normalizeText(candidate) === normalized);
        })?.value ?? '';
    };

    const buildInitialFormData = (): EditProfileFormData => {
        const region = resolveRegionValue(user.region);

        return {
            full_name: user.full_name ?? '',
            phone: user.phone ?? '',
            address: user.address ?? '',
            region,
            district: resolveDistrictValue(region, user.district)
        };
    };

    useEffect(() => {
        if (user) {
            setFormData(buildInitialFormData());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isOpen, t]);

    const handleRegionChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            region: value,
            district: ''
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const initialData = buildInitialFormData();
        const payload: EditProfileFormData = {
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim(),
            region: formData.region,
            district: formData.district
        };

        const hasChanges = (Object.keys(payload) as Array<keyof EditProfileFormData>).some(
            (key) => payload[key] !== initialData[key]
        );

        if (!hasChanges) {
            onClose();
            return;
        }

        mutate(payload, {
            onSuccess: () => {
                onClose();
                toast.success(t('profile.edit.saved'));
            }
        });
    };

    const inp = [
        'h-12 rounded-[16px]',
        'border border-mc-border dark:border-white/[0.085]',
        'bg-mc-surface',
        'text-mc-text',
        'placeholder:text-mc-text-3 dark:placeholder:text-mc-text-2',
        'transition-colors duration-150',
        'shadow-[inset_0_2px_8px_rgba(15,23,42,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        'focus:border-mc-brand/70 focus:ring-2 focus:ring-mc-brand/20 focus:ring-offset-0 focus:outline-none',
    ].join(' ');

    const currentDistricts = useMemo(() => formData.region ? DISTRICTS[formData.region] || [] : [], [formData.region]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className="top-auto bottom-0 left-0 max-h-[88svh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-mc-xl border border-mc-border bg-mc-surface p-0 shadow-[var(--mc-shadow-card)] backdrop-blur-xl data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-[460px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-mc-xl sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0"
            >
                <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-mc-surface-2 sm:hidden dark:bg-white/14" />
                <DialogHeader className="px-5 pb-2 pt-4 text-left sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-[22px] font-black tracking-normal text-mc-text">
                                {t('profile.edit.title')}
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-[13px] font-semibold leading-snug text-mc-text-2/56">
                        {t('profile.edit.description')}
                    </DialogDescription>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-10 w-10 shrink-0 rounded-full bg-mc-surface-2 text-mc-text"
                            aria-label={t('profile.edit.cancel')}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="max-h-[calc(88svh-92px)] space-y-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-2 sm:px-6">
                    <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-[12px] font-black text-mc-text/76">{t('profile.edit.fullName')}</Label>
                        <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className={inp}
                            required
                            minLength={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-[12px] font-black text-mc-text/76">{t('profile.edit.phone')}</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={inp}
                            required
                            pattern="^\+?[0-9\s]*$"
                        />
                    </div>

                    {/* Region Select */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-[12px] font-black text-mc-text/76">
                            <MapPin className="w-4 h-4 text-mc-brand" />
                            {t('profile.edit.region')}
                        </Label>
                        <Select onValueChange={handleRegionChange} value={formData.region}>
                            <SelectTrigger className={`${inp} w-full`}>
                                <SelectValue placeholder={t('form.regionPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-hidden rounded-mc-lg border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
                                {regions.map((r) => (
                                    <SelectItem
                                        key={r.value}
                                        value={r.value}
                                        className="cursor-pointer rounded-mc-sm"
                                    >
                                        {t(r.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* District Select */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-[12px] font-black text-mc-text/76">
                            <MapPin className="w-4 h-4 text-mc-brand opacity-50" />
                            {t('profile.edit.district')}
                        </Label>
                        <Select
                            key={formData.region}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, district: value }))}
                            value={formData.district}
                            disabled={!formData.region}
                        >
                            <SelectTrigger className={`${inp} w-full`}>
                                <SelectValue placeholder={t('form.districtPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-hidden rounded-mc-lg border-mc-border bg-mc-surface shadow-[var(--mc-shadow-card)]">
                                {currentDistricts.map((d) => (
                                    <SelectItem
                                        key={d.value}
                                        value={d.value}
                                        className="cursor-pointer rounded-mc-sm"
                                    >
                                        {t(d.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address" className="text-[12px] font-black text-mc-text/76">{t('profile.edit.address')}</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className={inp}
                        />
                    </div>

                    <DialogFooter className="sticky bottom-0 -mx-5 mt-6 border-t border-mc-border bg-mc-surface px-5 pt-4 pb-5 backdrop-blur-xl sm:-mx-6 sm:px-6">
                        <Button type="button" variant="outline" onClick={onClose} className="h-12 rounded-mc-md border-mc-border bg-mc-surface-2 text-mc-text">
                            {t('profile.edit.cancel')}
                        </Button>
                        <Button type="submit" disabled={isPending} className="h-12 rounded-[16px] bg-mc-brand font-black text-mc-on-brand shadow-[0_12px_24px_rgba(249,115,22,0.22)]">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('profile.edit.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
