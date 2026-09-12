import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Info,
  RefreshCw,
  RotateCcw,
  Send,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientDeliveryHistory } from "@/components/admin/delivery/ClientDeliveryHistory";
import ClientLookupPanel from "@/components/admin/delivery/ClientLookupPanel";
import FlightSelector from "@/components/admin/delivery/FlightSelector";
import CargoPreviewList from "@/components/admin/delivery/CargoPreviewList";
import DeliveryTypeSelector from "@/components/admin/delivery/DeliveryTypeSelector";
import RecipientFields from "@/components/admin/delivery/RecipientFields";
import StandardDeliveryForm from "@/components/admin/delivery/StandardDeliveryForm";
import UzpostDeliveryForm from "@/components/admin/delivery/UzpostDeliveryForm";
import UzPostLabelCopiesDialog from "@/components/warehouse/UzPostLabelCopiesDialog";
import {
  useAdminCreateStandardDelivery,
  useAdminCreateUzpostDelivery,
  useClientDeliveryContext,
} from "@/api/hooks/useAdminDelivery";
import { useUzPostLabelCopiesGate } from "@/hooks/useUzPostLabelCopiesGate";
import { hasUnpaidRows } from "@/lib/adminDeliveryFlights";
import {
  recipientProblems,
  toRecipientPayload,
  type RecipientDraft,
} from "@/lib/adminDeliveryRecipient";
import {
  readRecentClients,
  rememberRecentClient,
  writeRecentClients,
  type RecentDeliveryClient,
} from "@/lib/adminDeliveryRecentClients";

import type { AdminDeliverySuccessResponse } from "@/api/services/adminDeliveryService";
import type { UzpostBranch } from "@/types/uzpostBranch";

type DeliveryType = "self_pickup" | "yandex" | "mandarin" | "bts" | "uzpost";
type Step = "client" | "flights" | "type" | "form" | "success";

/** Literal fallbacks for the delivery-type label (used if a translation is missing). */
const DELIVERY_TYPE_FALLBACK: Record<DeliveryType, string> = {
  self_pickup: "O'zi olib ketish",
  yandex: "Yandex",
  mandarin: "Mandarin Dostavka",
  bts: "BTS",
  uzpost: "UzPost",
};

const STEPS_ORDER: Step[] = ["client", "flights", "type", "form"];

export default function AdminDeliveryRequestPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("client");
  const [selectedClient, setSelectedClient] = useState<RecentDeliveryClient | null>(null);
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [deliveryRequestId, setDeliveryRequestId] = useState<number | null>(null);
  // What the UzPost submission actually did beyond filing — kept so the success
  // screen can say it, rather than leaving the release and the printed label to
  // a toast the manager may have already dismissed.
  const [releaseResult, setReleaseResult] =
    useState<AdminDeliverySuccessResponse | null>(null);

  // Recipient. Both start as "use the profile": null means untouched, so the
  // phone follows the freshly read profile phone until the manager edits it,
  // and a refetch never overwrites what was typed.
  const [typedRecipientName, setTypedRecipientName] = useState<string | null>(null);
  const [typedPhone, setTypedPhone] = useState<string | null>(null);
  const [showRecipientProblems, setShowRecipientProblems] = useState(false);

  // Standard form state
  const [standardCaption, setStandardCaption] = useState("");
  const [standardLocation, setStandardLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Uzpost form state
  const [uzpostBranch, setUzpostBranch] = useState<UzpostBranch | null>(null);

  // Recent clients: code and name only (see adminDeliveryRecentClients).
  const [searchHistory, setSearchHistory] = useState<RecentDeliveryClient[]>(
    () => readRecentClients(),
  );

  // The flights, their rows and the requests already on them are what the
  // request is filed from. Invalidated after every filing (useAdminDelivery).
  const clientCode = selectedClient?.client_code ?? null;
  const contextQuery = useClientDeliveryContext(clientCode, 0);
  const context = contextQuery.data;
  const flights = useMemo(() => context?.flights ?? [], [context]);

  // Read again each time the flights step opens, not only after this page files:
  // the client, or another manager, may have filed for the same flights since.
  // `cancelRefetch: false` joins a fetch already running for a just-picked client.
  const { refetch: refetchContext } = contextQuery;
  useEffect(() => {
    if (step === "flights" && clientCode) {
      void refetchContext({ cancelRefetch: false });
    }
  }, [step, clientCode, refetchContext]);

  const standardMutation = useAdminCreateStandardDelivery();
  const uzpostMutation = useAdminCreateUzpostDelivery();
  const { guard: guardLabelCopies, dialog: labelCopiesDialog } =
    useUzPostLabelCopiesGate();

  const isSubmitting = standardMutation.isPending || uzpostMutation.isPending;

  /** Everything that belongs to one request, cleared between requests. */
  const resetRequestState = useCallback(() => {
    setSelectedFlights([]);
    setDeliveryType(null);
    setDeliveryRequestId(null);
    setReleaseResult(null);
    setTypedRecipientName(null);
    setTypedPhone(null);
    setShowRecipientProblems(false);
    setStandardCaption("");
    setStandardLocation(null);
    setUzpostBranch(null);
  }, []);

  const handleSelectClient = useCallback(
    (client: RecentDeliveryClient) => {
      resetRequestState();
      setSelectedClient(client);
      setStep("flights");
      const next = rememberRecentClient(searchHistory, client);
      setSearchHistory(next);
      writeRecentClients(next);
    },
    [resetRequestState, searchHistory],
  );

  const handleClearHistory = useCallback(() => {
    setSearchHistory([]);
    writeRecentClients([]);
  }, []);

  const handleToggleFlight = useCallback((flightName: string) => {
    setSelectedFlights((prev) =>
      prev.includes(flightName)
        ? prev.filter((f) => f !== flightName)
        : [...prev, flightName],
    );
  }, []);

  // Only flights that exist in the current read are sent: one ticked before a
  // refetch that no longer returns it must not reach the request.
  const submittableFlights = useMemo(
    () => selectedFlights.filter((name) => flights.some((flight) => flight.flight === name)),
    [selectedFlights, flights],
  );

  // Decided from what is on screen, so a hidden stale name in the selection
  // cannot turn "select all" into "clear all".
  const handleSelectAllFlights = useCallback(() => {
    const all = flights.map((flight) => flight.flight);
    const everyShownSelected =
      all.length > 0 && all.every((name) => submittableFlights.includes(name));
    setSelectedFlights(everyShownSelected ? [] : all);
  }, [flights, submittableFlights]);

  const canProceedToType = submittableFlights.length > 0;

  const hasUnpaidCargo = useMemo(
    () => hasUnpaidRows(flights, submittableFlights),
    [flights, submittableFlights],
  );

  const isStandard = deliveryType !== null && deliveryType !== "uzpost";
  const isUzpost = deliveryType === "uzpost";

  const recipientDraft = useMemo<RecipientDraft>(
    () => ({
      profileName: context?.full_name ?? selectedClient?.full_name ?? "",
      typedName: typedRecipientName,
      phone: typedPhone ?? context?.phone ?? "",
    }),
    [context, selectedClient, typedRecipientName, typedPhone],
  );
  const problems = useMemo(() => recipientProblems(recipientDraft), [recipientDraft]);

  // UzPost requires a destination branch — block submit until one is picked.
  // Recipient problems do not disable the button: pressing it shows them.
  const canSubmit =
    Boolean(context) &&
    submittableFlights.length > 0 &&
    (isUzpost ? Boolean(uzpostBranch) : Boolean(deliveryType));

  const handleSubmit = useCallback(() => {
    if (!selectedClient || !deliveryType || submittableFlights.length === 0) return;
    if (problems.length > 0) {
      setShowRecipientProblems(true);
      return;
    }

    const recipient = toRecipientPayload(recipientDraft);
    const onFiled = (res: AdminDeliverySuccessResponse) => {
      setDeliveryRequestId(res.delivery_request_id);
      setReleaseResult(res);
      setStep("success");
    };

    if (isStandard) {
      standardMutation.mutate(
        {
          client_code: selectedClient.client_code,
          delivery_type: deliveryType as "self_pickup" | "yandex" | "mandarin" | "bts",
          flight_names: submittableFlights,
          phone_number: recipient.phone_number,
          recipient_name: recipient.recipient_name,
          caption: standardCaption.trim() || undefined,
          latitude: standardLocation?.latitude ?? null,
          longitude: standardLocation?.longitude ?? null,
        },
        { onSuccess: onFiled },
      );
    } else if (isUzpost) {
      const formData = new FormData();
      formData.append("client_code", selectedClient.client_code);
      formData.append("flight_names", JSON.stringify(submittableFlights));
      if (uzpostBranch) {
        formData.append("location_id", String(uzpostBranch.id));
      }
      formData.append("phone_number", recipient.phone_number);
      if (recipient.recipient_name) {
        formData.append("recipient_name", recipient.recipient_name);
      }

      // Filing can print the label straight away, so the one person who decides
      // the copy count is asked first, once. Everyone else files as before.
      guardLabelCopies(() => uzpostMutation.mutate(formData, { onSuccess: onFiled }));
    }
  }, [
    selectedClient,
    deliveryType,
    submittableFlights,
    problems,
    recipientDraft,
    isStandard,
    isUzpost,
    standardCaption,
    standardLocation,
    uzpostBranch,
    standardMutation,
    uzpostMutation,
    guardLabelCopies,
  ]);

  /** A different client: back to the search. */
  const handleReset = useCallback(() => {
    resetRequestState();
    setSelectedClient(null);
    setStep("client");
  }, [resetRequestState]);

  /**
   * The same client, another recipient. A client with a lot of cargo sends it
   * to several people, one request each; the flights step then shows which
   * flights are already on their way.
   */
  const handleAnotherRecipient = useCallback(() => {
    resetRequestState();
    setStep("flights");
  }, [resetRequestState]);

  const stepLabels = useMemo(
    () => ({
      client: t("adminDeliveryRequest.steps.client", "Mijoz"),
      flights: t("adminDeliveryRequest.steps.flights", "Reyslar"),
      type: t("adminDeliveryRequest.steps.type", "Tur"),
      form: t("adminDeliveryRequest.steps.form", "Forma"),
      success: t("adminDeliveryRequest.steps.success", "Tayyor"),
    }),
    [t],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {step !== "success" && (
              // Disabled while a request is being filed: leaving the step then
              // would let the late result land on whatever the page shows next,
              // even another client.
              <button
                type="button"
                aria-label={t("adminDeliveryRequest.actions.back", "Orqaga")}
                disabled={isSubmitting}
                onClick={() => {
                  if (step === "client") {
                    window.history.back();
                    return;
                  }
                  const idx = STEPS_ORDER.indexOf(step);
                  if (idx > 0) setStep(STEPS_ORDER[idx - 1]);
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("adminDeliveryRequest.title", "Yetkazib berish zayavkasi")}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("adminDeliveryRequest.subtitle", "Mijoz nomidan zayavka yuborish")}
              </p>
            </div>
          </div>

          {/* Step indicator */}
          {step !== "success" && (
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
              {STEPS_ORDER.map((s, i) => {
                const isActive = s === step;
                const isPast = STEPS_ORDER.indexOf(step) > i;
                const isClickable = STEPS_ORDER.indexOf(step) >= i && !isSubmitting;

                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => {
                      if (isClickable) setStep(s);
                    }}
                    className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
                        : isPast
                        ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : "bg-gray-100 text-gray-400 dark:bg-white/[0.04]"
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-current text-white">
                        {i + 1}
                      </span>
                    )}
                    {stepLabels[s]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {step === "client" && (
            <motion.div
              key="client"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {t("adminDeliveryRequest.clientSearch.title", "Mijozni qidiring")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  {t("adminDeliveryRequest.clientSearch.description", "Kod bo'yicha qidiring va mijozni tanlang")}
                </p>
                <ClientLookupPanel
                  onSelectClient={handleSelectClient}
                  selectedClientCode={clientCode}
                  recentClients={searchHistory}
                  onClearHistory={handleClearHistory}
                />
              </div>
            </motion.div>
          )}

          {step === "flights" && selectedClient && (
            <motion.div
              key="flights"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white break-words">
                      {context?.full_name || selectedClient.full_name || selectedClient.client_code}
                    </h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {selectedClient.client_code}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-11 shrink-0 rounded-lg px-2 text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {t("adminDeliveryRequest.actions.changeClient", "Boshqa mijoz")}
                  </button>
                </div>

                {/* Placed above the flight picker on purpose: "has someone
                    already filed for this client" changes whether you file at
                    all, so it has to be read before the flights are chosen,
                    not after. */}
                <ClientDeliveryHistory clientCode={selectedClient.client_code} />

                <div className="mt-4">
                  {contextQuery.isLoading ? (
                    <div aria-busy="true" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <span className="sr-only">
                        {t("adminDeliveryRequest.flights.loading", "Reyslar yuklanmoqda…")}
                      </span>
                      {[0, 1].map((placeholder) => (
                        <div
                          key={placeholder}
                          className="h-24 rounded-2xl bg-gray-100 dark:bg-white/[0.06] animate-pulse motion-reduce:animate-none"
                        />
                      ))}
                    </div>
                  ) : contextQuery.isError ? (
                    <div
                      role="alert"
                      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center dark:border-red-500/20 dark:bg-red-500/10"
                    >
                      <p className="flex flex-1 items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {t("adminDeliveryRequest.flights.loadError", "Reyslarni yuklab bo'lmadi")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void contextQuery.refetch()}
                        className="h-11 rounded-xl"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                        {t("adminDeliveryRequest.flights.retry", "Qayta urinish")}
                      </Button>
                    </div>
                  ) : flights.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 dark:border-white/10">
                      {t("adminDeliveryRequest.flights.empty", "Mijozda reys topilmadi")}
                    </p>
                  ) : (
                    <>
                      {contextQuery.isFetching && (
                        <p aria-live="polite" className="mb-2 flex items-center gap-1.5 text-[11px] text-gray-400">
                          <RefreshCw className="w-3 h-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          {t("adminDeliveryRequest.flights.refreshing", "Yangilanmoqda…")}
                        </p>
                      )}
                      <FlightSelector
                        flights={flights}
                        selectedFlights={submittableFlights}
                        onToggleFlight={handleToggleFlight}
                        onSelectAll={handleSelectAllFlights}
                      />

                      {submittableFlights.length > 0 && (
                        <div className="mt-6">
                          <CargoPreviewList
                            flights={flights}
                            selectedFlightNames={submittableFlights}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Inline action — flows with content so it never overlaps or leaves
                  a gap above the (context-dependent) bottom nav. */}
              {hasUnpaidCargo && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 mb-4">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      {t("adminDeliveryRequest.unpaidWarning.title", "To'lanmagan yuklar mavjud")}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {t("adminDeliveryRequest.unpaidWarning.description", "Zayavka yaratiladi. To'lov yetkazib berishda undiriladi.")}
                    </p>
                  </div>
                </div>
              )}
              <Button
                onClick={() => setStep("type")}
                disabled={!canProceedToType}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50"
              >
                {t("adminDeliveryRequest.actions.continue", "Davom etish")}
                <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
              </Button>
            </motion.div>
          )}

          {step === "type" && (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-sm">
                <DeliveryTypeSelector
                  value={deliveryType}
                  onChange={(type) => {
                    setDeliveryType(type);
                    setStep("form");
                  }}
                />
              </div>
            </motion.div>
          )}

          {step === "form" && deliveryType && selectedClient && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">
                  {t(`adminDeliveryRequest.deliveryType.labels.${deliveryType}`, DELIVERY_TYPE_FALLBACK[deliveryType])}{" "}
                  — {t("adminDeliveryRequest.form.title", "Zayavka ma'lumotlari")}
                </h2>

                <div className="space-y-5">
                  <RecipientFields
                    profileName={recipientDraft.profileName}
                    typedName={typedRecipientName}
                    onTypedNameChange={setTypedRecipientName}
                    phone={recipientDraft.phone}
                    onPhoneChange={setTypedPhone}
                    problems={showRecipientProblems ? problems : []}
                  />

                  {isStandard && (
                    <StandardDeliveryForm
                      caption={standardCaption}
                      onCaptionChange={setStandardCaption}
                      location={standardLocation}
                      onLocationChange={setStandardLocation}
                    />
                  )}

                  {isUzpost && (
                    <UzpostDeliveryForm
                      selectedBranch={uzpostBranch}
                      onBranchChange={setUzpostBranch}
                      clientCode={selectedClient.client_code}
                    />
                  )}
                </div>

                {/* Inline submit — inside the card so it flows with content and never
                    overlaps or leaves a gap above the (context-dependent) bottom nav. */}
                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-white/10">
                  {context && submittableFlights.length === 0 && (
                    // A refetch while the form was open no longer returns the
                    // chosen flights; say so instead of a button that does nothing.
                    <p role="alert" className="text-[12px] font-medium text-amber-700 dark:text-amber-400 mb-2 text-center">
                      {t("adminDeliveryRequest.form.noFlights", "Tanlangan reyslar endi mijozda yo'q — reyslarni qayta tanlang")}
                    </p>
                  )}
                  {isUzpost && !uzpostBranch && (
                    <p className="text-[12px] text-amber-600 dark:text-amber-400 mb-2 text-center">
                      {t("adminDeliveryRequest.uzpostForm.branchRequired", "Yuborish uchun UzPost filialini tanlang")}
                    </p>
                  )}
                  {showRecipientProblems && problems.length > 0 && (
                    <p role="alert" className="text-[12px] font-medium text-red-600 dark:text-red-400 mb-2 text-center">
                      {t("adminDeliveryRequest.submit.fixRecipient", "Qabul qiluvchi ma'lumotlarini to'ldiring")}
                    </p>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !canSubmit}
                    className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("adminDeliveryRequest.submit.sending", "Yuborilmoqda...")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        {t("adminDeliveryRequest.submit.button", "Zayavkani yuborish")}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "success" && deliveryRequestId && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-6 sm:p-8 shadow-sm text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {t("adminDeliveryRequest.submit.successTitle", "Zayavka yuborildi!")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  {t("adminDeliveryRequest.submit.successDesc", "Mijoz nomidan yetkazib berish so'rovi muvaffaqiyatli yaratildi.")}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  ID: {deliveryRequestId}
                </p>

                {/* The release is the consequential half of this submission, so
                    it gets its own line on the screen that stays put — a toast
                    is gone in seconds and a warehouse question comes later. */}
                {releaseResult?.auto_released && (
                  <div className="mt-4 p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-left">
                    <p className="text-[12px] font-semibold text-green-800 dark:text-green-300">
                      {releaseResult.released_count} ta yuk ombordan chiqarildi
                    </p>
                    <p className="text-[11px] text-green-700/80 dark:text-green-400/80 mt-0.5">
                      Chek printerga yuborildi
                      {releaseResult.uzpost_order_number
                        ? ` · ${releaseResult.uzpost_order_number}`
                        : ""}
                    </p>
                  </div>
                )}

                {releaseResult?.release_warning && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-left">
                    <p className="text-[12px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      {releaseResult.release_warning}
                    </p>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-2">
                  <Button
                    onClick={handleAnotherRecipient}
                    className="h-auto min-h-12 w-full whitespace-normal rounded-xl bg-orange-500 px-4 py-3 text-white font-semibold hover:bg-orange-600"
                  >
                    <UserPlus className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />
                    {t("adminDeliveryRequest.submit.anotherRecipient", "Boshqa qabul qiluvchi uchun yana zayavka")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="h-auto min-h-12 w-full whitespace-normal rounded-xl px-4 py-3 font-semibold"
                  >
                    <RotateCcw className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />
                    {t("adminDeliveryRequest.submit.newRequest", "Yangi zayavka")}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <UzPostLabelCopiesDialog mode="ask" {...labelCopiesDialog} />
    </div>
  );
}
