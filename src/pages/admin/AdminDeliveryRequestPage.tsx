import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, CheckCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientLookupPanel from "@/components/admin/delivery/ClientLookupPanel";
import FlightSelector from "@/components/admin/delivery/FlightSelector";
import CargoPreviewList from "@/components/admin/delivery/CargoPreviewList";
import DeliveryTypeSelector from "@/components/admin/delivery/DeliveryTypeSelector";
import StandardDeliveryForm from "@/components/admin/delivery/StandardDeliveryForm";
import UzpostDeliveryForm from "@/components/admin/delivery/UzpostDeliveryForm";
import {
  useAdminCreateStandardDelivery,
  useAdminCreateUzpostDelivery,
} from "@/api/hooks/useAdminDelivery";

import type { ClientGroup } from "@/api/services/warehouse";
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

export default function AdminDeliveryRequestPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("client");
  const [selectedClient, setSelectedClient] = useState<ClientGroup | null>(null);
  const [selectedFlights, setSelectedFlights] = useState<string[]>([]);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [deliveryRequestId, setDeliveryRequestId] = useState<number | null>(null);

  // Standard form state
  const [standardPhone, setStandardPhone] = useState("");
  const [standardCaption, setStandardCaption] = useState("");
  const [standardLocation, setStandardLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Uzpost form state
  const [uzpostPhone, setUzpostPhone] = useState("");
  const [uzpostBranch, setUzpostBranch] = useState<UzpostBranch | null>(null);


  // Recent client search history (last 10)
  const [searchHistory, setSearchHistory] = useState<ClientGroup[]>(() => {
    try {
      const raw = localStorage.getItem("admin_delivery_search_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const standardMutation = useAdminCreateStandardDelivery();
  const uzpostMutation = useAdminCreateUzpostDelivery();

  const isSubmitting = standardMutation.isPending || uzpostMutation.isPending;

  const handleSelectClient = useCallback((client: ClientGroup) => {
    setSelectedClient(client);
    setSelectedFlights([]);
    setDeliveryType(null);
    setStep("flights");
    setSearchHistory((prev) => {
      const filtered = prev.filter((c) => c.client_code !== client.client_code);
      const next = [client, ...filtered].slice(0, 10);
      localStorage.setItem("admin_delivery_search_history", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem("admin_delivery_search_history");
  }, []);

  const handleToggleFlight = useCallback((flightName: string) => {
    setSelectedFlights((prev) =>
      prev.includes(flightName)
        ? prev.filter((f) => f !== flightName)
        : [...prev, flightName],
    );
  }, []);

  const handleSelectAllFlights = useCallback(() => {
    if (!selectedClient) return;
    const all = selectedClient.flights.map((f) => f.flight_name);
    setSelectedFlights((prev) =>
      prev.length === all.length ? [] : all,
    );
  }, [selectedClient]);

  const canProceedToType = selectedFlights.length > 0;

  const isStandard = deliveryType && deliveryType !== "uzpost";
  const isUzpost = deliveryType === "uzpost";



  const handleSubmit = useCallback(() => {
    if (!selectedClient || !deliveryType || selectedFlights.length === 0) return;

    if (isStandard) {
      standardMutation.mutate(
        {
          client_code: selectedClient.client_code,
          delivery_type: deliveryType as "self_pickup" | "yandex" | "mandarin" | "bts",
          flight_names: selectedFlights,
          phone_number: standardPhone.trim() || undefined,
          caption: standardCaption.trim() || undefined,
          latitude: standardLocation?.latitude ?? null,
          longitude: standardLocation?.longitude ?? null,
        },
        {
          onSuccess: (res) => {
            setDeliveryRequestId(res.delivery_request_id);
            setStep("success");
          },
        },
      );
    } else if (isUzpost) {
      const formData = new FormData();
      formData.append("client_code", selectedClient.client_code);
      formData.append("flight_names", JSON.stringify(selectedFlights));
      if (uzpostBranch) {
        formData.append("location_id", String(uzpostBranch.id));
      }
      formData.append("phone_number", uzpostPhone.trim() || selectedClient.phone || "");

      uzpostMutation.mutate(formData, {
        onSuccess: (res) => {
          setDeliveryRequestId(res.delivery_request_id);
          setStep("success");
        },
      });
    }
  }, [
    selectedClient,
    deliveryType,
    selectedFlights,
    isStandard,
    isUzpost,
    standardPhone,
    standardCaption,
    standardLocation,
    uzpostPhone,
    uzpostBranch,
    standardMutation,
    uzpostMutation,
  ]);

  const handleReset = useCallback(() => {
    setStep("client");
    setSelectedClient(null);
    setSelectedFlights([]);
    setDeliveryType(null);
    setDeliveryRequestId(null);
    setStandardPhone("");
    setStandardCaption("");
    setStandardLocation(null);
    setUzpostPhone("");
    setUzpostBranch(null);

  }, []);

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

  const stepsOrder: Step[] = ["client", "flights", "type", "form"];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {step !== "success" && (
              <button
                onClick={() => {
                  if (step === "client") {
                    window.history.back();
                    return;
                  }
                  const idx = stepsOrder.indexOf(step);
                  if (idx > 0) setStep(stepsOrder[idx - 1]);
                }}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            <div>
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
              {stepsOrder.map((s, i) => {
                const isActive = s === step;
                const isPast = stepsOrder.indexOf(step) > i;
                const isClickable = stepsOrder.indexOf(step) >= i;

                return (
                  <button
                    key={s}
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
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {t("adminDeliveryRequest.clientSearch.title", "Mijozni qidiring")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  {t("adminDeliveryRequest.clientSearch.description", "Kod bo'yicha qidiring va mijozni tanlang")}
                </p>
                <ClientLookupPanel
                  onSelectClient={handleSelectClient}
                  selectedClient={selectedClient}
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
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {selectedClient.full_name || selectedClient.client_code}
                    </h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {selectedClient.client_code}
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {t("adminDeliveryRequest.actions.changeClient", "Boshqa mijoz")}
                  </button>
                </div>

                <FlightSelector
                  flights={selectedClient.flights}
                  selectedFlights={selectedFlights}
                  onToggleFlight={handleToggleFlight}
                  onSelectAll={handleSelectAllFlights}
                />

                {selectedFlights.length > 0 && (
                  <div className="mt-6">
                    <CargoPreviewList
                      flights={selectedClient.flights}
                      selectedFlightNames={selectedFlights}
                    />
                  </div>
                )}
              </div>

              {/* Sticky bottom action */}
              <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-t border-gray-200 dark:border-white/10 z-20">
                <div className="max-w-5xl mx-auto">
                  <Button
                    onClick={() => setStep("type")}
                    disabled={!canProceedToType}
                    className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50"
                  >
                    {t("adminDeliveryRequest.actions.continue", "Davom etish")}
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "type" && (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
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

          {step === "form" && deliveryType && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">
                  {t(`adminDeliveryRequest.deliveryType.labels.${deliveryType}`, DELIVERY_TYPE_FALLBACK[deliveryType])}{" "}
                  — {t("adminDeliveryRequest.form.title", "Zayavka ma'lumotlari")}
                </h2>

                {isStandard && (
                  <StandardDeliveryForm
                    phone={standardPhone}
                    onPhoneChange={setStandardPhone}
                    caption={standardCaption}
                    onCaptionChange={setStandardCaption}
                    location={standardLocation}
                    onLocationChange={setStandardLocation}
                  />
                )}

                {isUzpost && selectedClient && (
                  <UzpostDeliveryForm
                    phone={uzpostPhone}
                    onPhoneChange={setUzpostPhone}
                    selectedBranch={uzpostBranch}
                    onBranchChange={setUzpostBranch}
                  />
                )}
              </div>

              {/* Sticky bottom action */}
              <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-t border-gray-200 dark:border-white/10 z-20">
                <div className="max-w-5xl mx-auto">
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
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
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/10 p-8 shadow-sm text-center">
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

                <Button
                  onClick={handleReset}
                  className="mt-6 h-12 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t("adminDeliveryRequest.submit.newRequest", "Yangi zayavka")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
