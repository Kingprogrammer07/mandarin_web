import { Banknote, CreditCard, type LucideIcon } from 'lucide-react';

import type { PaymentMethod } from '@/api/services/expenseService';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; Icon: LucideIcon }[] = [
  { value: 'cash', label: 'Naqd', Icon: Banknote },
  { value: 'card', label: 'Karta', Icon: CreditCard },
];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: 'Naqd', card: 'Karta' };

/**
 * A category keeps one pale tint (by id), so the eye finds "Logistika" by
 * colour down a long list. Five tints from the token set, dark mode included.
 */
const CATEGORY_TINTS = [
  'bg-mc-tile-blue text-mc-tile-blue-ink',
  'bg-mc-tile-green text-mc-tile-green-ink',
  'bg-mc-tile-orange text-mc-tile-orange-ink',
  'bg-mc-tile-rose text-mc-tile-rose-ink',
  'bg-mc-surface-2 text-mc-text',
];

export function categoryTint(categoryId: number): string {
  return CATEGORY_TINTS[Math.abs(categoryId) % CATEGORY_TINTS.length];
}
