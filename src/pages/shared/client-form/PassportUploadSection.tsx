import { FormField, FormItem, FormLabel } from '@/components/ui/form';
import ImageUpload from '@/components/ImageUpload';
import type { UseFormReturn } from 'react-hook-form';
import type { ClientFormData } from './schema';

interface PassportUploadSectionProps {
  form: UseFormReturn<ClientFormData>;
  frontImagePreview: string | null;
  backImagePreview: string | null;
  isLoadingImages: boolean;
  onFrontImageChange: (file: File | null) => void;
  onBackImageChange: (file: File | null) => void;
  t: (key: string) => string;
}

export function PassportUploadSection({
  form,
  frontImagePreview,
  backImagePreview,
  isLoadingImages,
  onFrontImageChange,
  onBackImageChange,
  t,
}: PassportUploadSectionProps) {
  return (
    <FormField
      control={form.control}
      name="passportImages"
      render={() => (
        <FormItem>
          <FormLabel className="text-gray-700 font-medium">
            {t('client.passportImages')} <span className="text-red-500">*</span>
          </FormLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUpload
              label={t('client.passportImagesFront')}
              value={frontImagePreview || undefined}
              onChange={onFrontImageChange}
              isLoading={isLoadingImages}
            />
            <ImageUpload
              label={t('client.passportImagesBack')}
              value={backImagePreview || undefined}
              onChange={onBackImageChange}
              isLoading={isLoadingImages}
            />
          </div>
          {form.formState.errors.passportImages && (
            <p className="text-red-500 text-sm">
              {t(form.formState.errors.passportImages.message as string)}
            </p>
          )}
        </FormItem>
      )}
    />
  );
}
