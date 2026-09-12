import { useTranslation } from "react-i18next";
import { Pencil, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RECIPIENT_NAME_MAX_LENGTH,
  RECIPIENT_PHONE_MAX_LENGTH,
  type RecipientProblem,
} from "@/lib/adminDeliveryRecipient";

interface RecipientFieldsProps {
  /** The account holder's name, used until another name is chosen. */
  profileName: string;
  /** The typed name, or null while the profile name is used. */
  typedName: string | null;
  onTypedNameChange: (next: string | null) => void;
  phone: string;
  onPhoneChange: (next: string) => void;
  /** Problems to point at. The page passes them only after a submit attempt. */
  problems: RecipientProblem[];
}

/**
 * Who the parcel goes to, for every delivery type.
 *
 * A client with a lot of cargo sends parcels to other people, so the name is
 * either the account holder's or typed. Two states rather than a text box
 * prefilled with the profile name: an always-editable field invites a quiet
 * edit of the client's own name, and "another name" starts empty so the manager
 * types the recipient instead of adjusting the account holder.
 */
export default function RecipientFields({
  profileName,
  typedName,
  onTypedNameChange,
  phone,
  onPhoneChange,
  problems,
}: RecipientFieldsProps) {
  const { t } = useTranslation();
  const isTyped = typedName !== null;

  const nameProblem = problems.find((problem) => problem.startsWith("name-"));
  const nameMessage =
    nameProblem === "name-missing"
      ? t("adminDeliveryRequest.recipient.nameMissing", "Qabul qiluvchi ismini kiriting")
      : nameProblem === "name-too-long"
        ? t("adminDeliveryRequest.recipient.nameTooLong", {
            max: RECIPIENT_NAME_MAX_LENGTH,
            defaultValue: "Ism juda uzun: ko'pi bilan {{max}} belgi",
          })
        : nameProblem === "name-formula"
          ? t(
              "adminDeliveryRequest.recipient.nameFormula",
              'Ism "=" belgisi bilan boshlanmasin',
            )
          : null;

  const phoneProblem = problems.find((problem) => problem.startsWith("phone-"));
  const phoneMessage =
    phoneProblem === "phone-missing"
      ? t("adminDeliveryRequest.recipient.phoneMissing", "Qabul qiluvchi telefonini kiriting")
      : phoneProblem === "phone-too-long"
        ? t("adminDeliveryRequest.recipient.phoneTooLong", {
            max: RECIPIENT_PHONE_MAX_LENGTH,
            defaultValue: "Telefon juda uzun: ko'pi bilan {{max}} belgi",
          })
        : null;

  return (
    <section
      aria-labelledby="recipient-heading"
      className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <h3
        id="recipient-heading"
        className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
      >
        <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
        {t("adminDeliveryRequest.recipient.title", "Qabul qiluvchi")}
      </h3>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label
            htmlFor={isTyped ? "recipient-name" : undefined}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("adminDeliveryRequest.recipient.nameLabel", "Ism")}
          </Label>
          <button
            type="button"
            onClick={() => onTypedNameChange(isTyped ? null : "")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-orange-600 transition hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95 motion-reduce:transition-none dark:text-orange-400"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {isTyped
              ? t("adminDeliveryRequest.recipient.useProfile", "Profildagi ism")
              : t("adminDeliveryRequest.recipient.useOther", "Boshqa ism")}
          </button>
        </div>

        {isTyped ? (
          <Input
            id="recipient-name"
            value={typedName}
            onChange={(event) => onTypedNameChange(event.target.value)}
            placeholder={t(
              "adminDeliveryRequest.recipient.namePlaceholder",
              "Qabul qiluvchining ism-familiyasi",
            )}
            autoComplete="off"
            maxLength={RECIPIENT_NAME_MAX_LENGTH}
            aria-invalid={Boolean(nameMessage)}
            aria-describedby={nameMessage ? "recipient-name-error" : undefined}
            className="h-12 rounded-xl text-base"
          />
        ) : (
          <p className="flex min-h-12 items-center break-words rounded-xl border border-gray-200 bg-white px-3 py-2 text-base font-medium text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            {profileName ||
              t(
                "adminDeliveryRequest.recipient.profileEmpty",
                'Profilda ism yo\'q — "Boshqa ism" ni bosing',
              )}
          </p>
        )}

        {nameMessage && (
          <p
            id="recipient-name-error"
            role="alert"
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            {nameMessage}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="recipient-phone"
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <Phone className="h-4 w-4 text-gray-400" aria-hidden="true" />
          {t("adminDeliveryRequest.recipient.phoneLabel", "Telefon")}
        </Label>
        <Input
          id="recipient-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="+998901234567"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          maxLength={RECIPIENT_PHONE_MAX_LENGTH}
          aria-invalid={Boolean(phoneMessage)}
          aria-describedby={phoneMessage ? "recipient-phone-error" : "recipient-phone-hint"}
          className="h-12 rounded-xl text-base"
        />
        {phoneMessage ? (
          <p
            id="recipient-phone-error"
            role="alert"
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            {phoneMessage}
          </p>
        ) : (
          <p id="recipient-phone-hint" className="text-xs text-gray-500 dark:text-gray-400">
            {t(
              "adminDeliveryRequest.recipient.phoneHint",
              "Mijoz profilidagi raqam qo'yildi. Boshqa odamga ketsa, uning raqamini yozing.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
