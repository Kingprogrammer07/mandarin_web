import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Eye,
  FileText,
  Info,
  Loader2,
  Power,
  RefreshCw,
  Save,
} from 'lucide-react';
import { NATIVE_OPTION_CLASS, NATIVE_SELECT_CLASS } from '@/components/ui/select-styles';
import {
  campaignService,
  type NotificationTemplate,
  type TemplatePreview,
} from '@/api/services/campaignService';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Edit the message bodies clients receive, per channel and language.
 *
 * The preview is rendered by the server, not here: it must use the same
 * substitution, the same HTML escaping and the same SMS segment accounting as
 * the real send. A browser-side copy would eventually disagree and quietly
 * under-report what a broadcast costs.
 */

const TEMPLATES_QUERY_KEY = ['notification-templates'] as const;
const PREVIEW_DEBOUNCE_MS = 600;

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  sms: 'SMS',
};

const LANG_LABELS: Record<string, string> = {
  uz: "O'zbekcha",
  ru: 'Ruscha',
};

/**
 * Human name first. The raw key (`cargo_in_china`) is a database identifier —
 * an operator had to decode English snake_case before knowing which message
 * they were about to edit.
 */
function templateLabel(template: NotificationTemplate): string {
  const name = template.label || template.key;
  const channel = CHANNEL_LABELS[template.channel] ?? template.channel;
  const lang = LANG_LABELS[template.lang] ?? template.lang;
  return `${name} — ${channel}, ${lang}`;
}

interface TemplateEditorProps {
  template: NotificationTemplate;
}

function TemplateEditor({ template }: TemplateEditorProps) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Seeded once per template — the parent remounts this via `key`, so a
  // different template never leaves stale text behind and no effect is needed
  // to resynchronise.
  const [title, setTitle] = useState(template.title ?? '');
  const [body, setBody] = useState(template.body);
  const [isActive, setIsActive] = useState(template.is_active);
  const [preview, setPreview] = useState<{ body: string; data: TemplatePreview } | null>(null);

  const previewMutation = useMutation({
    mutationFn: (draft: string) =>
      campaignService.previewTemplate({ body: draft, channel: template.channel }),
    onSuccess: (data, draft) => setPreview({ body: draft, data }),
  });

  // Debounced by callback rather than by an effect: typing should not fire a
  // request per keystroke, and an effect-driven debounce would need state
  // written from inside an effect.
  const requestPreview = useDebounce((draft: string) => {
    if (draft.trim()) previewMutation.mutate(draft);
  }, PREVIEW_DEBOUNCE_MS);

  const saveMutation = useMutation({
    mutationFn: () =>
      campaignService.updateTemplate(template.id, {
        body,
        title,
        is_active: isActive,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationTemplate[]>(TEMPLATES_QUERY_KEY, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success('Shablon saqlandi');
    },
    onError: () => toast.error("Shablonni saqlab bo'lmadi"),
  });

  const handleBodyChange = (value: string) => {
    setBody(value);
    requestPreview(value);
  };

  /** Insert a placeholder where the cursor is, not blindly at the end. */
  const insertPlaceholder = (name: string) => {
    const textarea = bodyRef.current;
    const token = `{${name}}`;
    if (!textarea) {
      handleBodyChange(body + token);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    handleBodyChange(next);
    // Restore the caret after React re-renders with the new value.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const isDirty =
    body !== template.body ||
    title !== (template.title ?? '') ||
    isActive !== template.is_active;
  const isPreviewStale = preview !== null && preview.body !== body;
  const available = preview?.data.available_placeholders ?? [
    'flight',
    'track',
    'item',
    'box',
    'count',
    'client_code',
    'channel',
  ];
  const unknown = preview?.data.unknown_placeholders ?? [];

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Sarlavha (ixtiyoriy)"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
      />

      <div>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(event) => handleBodyChange(event.target.value)}
          onBlur={() => requestPreview(body)}
          rows={8}
          className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 font-mono text-[13px] leading-relaxed dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {available.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => insertPlaceholder(name)}
              className="rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-bold text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-white/80"
            >
              {`{${name}}`}
            </button>
          ))}
        </div>
      </div>

      {unknown.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Bu belgilar hech narsa bilan almashmaydi va mijozga shundayligicha
          ketadi: {unknown.map((name) => `{${name}}`).join(', ')}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/45">
            <Eye className="h-3.5 w-3.5" />
            Namuna
            {template.channel === 'sms' && preview && !isPreviewStale && (
              <span className="ml-1 normal-case tracking-normal">
                · {preview.data.sms_length} belgi · {preview.data.sms_segments} SMS (
                {preview.data.sms_encoding})
              </span>
            )}
          </p>
          {(isPreviewStale || !preview) && (
            <button
              type="button"
              onClick={() => previewMutation.mutate(body)}
              disabled={previewMutation.isPending || !body.trim()}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 disabled:opacity-50 dark:text-sky-300"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Yangilash
            </button>
          )}
        </div>

        {preview ? (
          <pre
            className={`max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2.5 text-xs dark:bg-white/5 ${
              isPreviewStale
                ? 'text-gray-400 dark:text-white/35'
                : 'text-gray-800 dark:text-white/80'
            }`}
          >
            {preview.data.rendered}
          </pre>
        ) : (
          <p className="text-xs text-gray-400 dark:text-white/35">
            Matnni tahrirlang — namuna shu yerda chiqadi.
          </p>
        )}
        {isPreviewStale && (
          <p className="mt-1 text-[11px] font-semibold text-amber-600">
            Matn o'zgardi — namuna eskirgan.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsActive((current) => !current)}
          className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-black ${
            isActive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
          }`}
        >
          <Power className="h-3.5 w-3.5" />
          {isActive ? 'Faol' : "O'chirilgan"}
        </button>

        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!isDirty || saveMutation.isPending || !body.trim()}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDirty ? (
            <Save className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {isDirty ? 'Saqlash' : 'Saqlangan'}
        </button>
      </div>

      {!isActive && (
        <p className="text-[11px] font-semibold text-amber-600">
          O'chirilgan matn ishlatilmaydi — shu til va kanal uchun mijozlar hech
          narsa olmaydi.
        </p>
      )}
    </div>
  );
}

export default function TemplateEditorSection() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const {
    data: templates,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: () => campaignService.listTemplates(),
  });

  const selected =
    templates?.find((item) => item.id === selectedId) ?? templates?.[0] ?? null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/5">
          <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Xabar shablonlari
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Telegram va SMS xabarlari matni — kanal va til bo'yicha
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-white/45">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : isError ? (
        <div className="py-4">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Shablonlarni yuklab bo'lmadi.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 dark:border-white/10 dark:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Qayta urinish
          </button>
        </div>
      ) : !templates || templates.length === 0 ? (
        <p className="py-4 text-sm text-gray-500 dark:text-white/45">
          Shablon topilmadi. Migratsiya qo'llanilganini tekshiring.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            value={selected?.id ?? ''}
            onChange={(event) => setSelectedId(Number(event.target.value))}
            className={`w-full ${NATIVE_SELECT_CLASS}`}
          >
            {templates.map((template) => (
              <option key={template.id} className={NATIVE_OPTION_CLASS} value={template.id}>
                {templateLabel(template)}
                {template.is_active ? '' : " (o'chirilgan)"}
              </option>
            ))}
          </select>

          {selected?.description && (
            <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 dark:bg-sky-400/10 dark:text-sky-200">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {selected.description}
            </p>
          )}

          {/* Remounted per template so the editor state is seeded, not synced. */}
          {selected && <TemplateEditor key={selected.id} template={selected} />}
        </div>
      )}
    </div>
  );
}
