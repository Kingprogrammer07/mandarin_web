import { useMemo, useState } from "react";
import { Save, IdCard } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "../ImageUpload";
import {
  useClientPassportImages,
  useUpdateClientPassportImages,
} from "../../api/hooks/useAdminClients";

interface ClientPassportEditorProps {
  clientId: number;
}

/**
 * Passport image viewer + editor for the manager client drawer.
 *
 * Loads the client's current front/back passport images and lets staff replace
 * either slot. Only changed slots are sent; the backend preserves the untouched
 * slot, so updating the front never wipes the back. Backed by the RBAC
 * `clients:read` (view) / `clients:update` (replace) permissions.
 */
export function ClientPassportEditor({ clientId }: ClientPassportEditorProps) {
  const { data, isLoading } = useClientPassportImages(clientId);
  const { mutate: updatePassports, isPending } = useUpdateClientPassportImages();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  // Existing resolved URLs by slot (index 0 = front, 1 = back).
  const { frontUrl, backUrl } = useMemo(() => {
    const images = data?.images ?? [];
    return {
      frontUrl: images.find((img) => img.index === 0)?.telegram_url ?? null,
      backUrl: images.find((img) => img.index === 1)?.telegram_url ?? null,
    };
  }, [data?.images]);

  const hasChanges = frontFile !== null || backFile !== null;

  const handleSave = () => {
    if (!hasChanges) return;
    updatePassports(
      { clientId, payload: { front: frontFile, back: backFile } },
      {
        onSuccess: () => {
          toast.success("Pasport rasmlari yangilandi");
          setFrontFile(null);
          setBackFile(null);
        },
        onError: () => toast.error("Pasport rasmlarini yangilashda xatolik"),
      },
    );
  };

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
          <IdCard className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">
            Pasport rasmlari
          </h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Faqat o&apos;zgartirilgan rasm yangilanadi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ImageUpload
          label="Old tomoni"
          value={frontFile ?? frontUrl ?? undefined}
          onChange={setFrontFile}
          isLoading={isLoading}
          variant="compact"
        />
        <ImageUpload
          label="Orqa tomoni"
          value={backFile ?? backUrl ?? undefined}
          onChange={setBackFile}
          isLoading={isLoading}
          variant="compact"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!hasChanges || isPending}
        className="w-full h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {isPending ? "Saqlanmoqda..." : "Pasportni saqlash"}
      </button>
    </div>
  );
}
