import { useTranslation } from 'react-i18next';
import { useFormField } from '@/components/ui/form';

export default function TranslatedFormMessage() {
  const { t } = useTranslation();
  const { error, formMessageId } = useFormField();

  if (!error?.message) {
    return null;
  }

  return (
    <p
      id={formMessageId}
      className="text-red-600 text-sm mt-1"
    >
      {t(error.message)}
    </p>
  );
}
