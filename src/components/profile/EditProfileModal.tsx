import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useUpdateProfile } from '@/hooks/useProfile';
import { type ProfileResponse } from '@/types/profile';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: ProfileResponse;
}

export const EditProfileModal = ({ isOpen, onClose, user }: EditProfileModalProps) => {
    const { mutate, isPending } = useUpdateProfile();

    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        address: '',
        region: ''
    });

    useEffect(() => {
        if (user) {
<<<<<<< HEAD
            queueMicrotask(() => {
                setFormData({
                    full_name: user.full_name,
                    phone: user.phone,
                    address: user.address,
                    region: user.region
                });
=======
            setFormData({
                full_name: user.full_name,
                phone: user.phone,
                address: user.address,
                region: user.region
>>>>>>> 2b04cc3da2bdd52664f4a733cead166e9c977753
            });
        }
    }, [user, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutate(formData, {
            onSuccess: () => {
                onClose();
                toast.success("Muvaffaqiyatli saqlandi");
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#1e1a45] dark:border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">Profilni Tahrirlash</DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                        Shaxsiy ma'lumotlaringizni o'zgartiring.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-right">Ism Familiya</Label>
                        <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="col-span-3 bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10"
                            required
                            minLength={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-right">Telefon Raqam</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="col-span-3 bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10"
                            required
                            pattern="^\+?[0-9\s]*$"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="region" className="text-right">Hudud</Label>
                        {/* Ideally this should be a Select with UZBEKISTAN_REGIONS keys, but simple Input for now to match backend 'soft' validation */}
                        <Input
                            id="region"
                            value={formData.region}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            className="col-span-3 bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address" className="text-right">Manzil</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="col-span-3 bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/10"
                        />
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={onClose} className="border-gray-200 dark:border-white/10 dark:text-gray-300">
                            Bekor qilish
                        </Button>
                        <Button type="submit" disabled={isPending} className="bg-orange-500 hover:bg-orange-600 text-white">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Saqlash
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
