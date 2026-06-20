import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  GitMerge,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Upload,
  Volume2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  getExpectedCargoCustomSoundNames,
  getExpectedCargoSoundProfileSnapshot,
  initializeExpectedCargoSounds,
  refreshExpectedCargoSoundCache,
  testExpectedCargoSound,
} from '@/utils/expectedCargoSoundManager';
import {
  EXPECTED_CARGO_SOUND_EVENTS,
  createDefaultExpectedCargoSoundProfile,
  expectedCargoSoundStorage,
  type ExpectedCargoPlaybackMode,
  type ExpectedCargoSoundEvent,
  type ExpectedCargoSoundProfile,
  type ExpectedCargoSoundSource,
} from '@/utils/expectedCargoSoundStorage';

interface ScannerSoundSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SoundEventMeta {
  label: string;
  description: string;
  icon: typeof CheckCircle2;
  color: string;
}

const MAX_AUDIO_FILE_SIZE = 15 * 1024 * 1024;

const EVENT_META: Record<ExpectedCargoSoundEvent, SoundEventMeta> = {
  success: {
    label: 'Muvaffaqiyat',
    description: 'Track code to‘g‘ri aniqlanganda',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    label: 'Ogohlantirish',
    description: 'Navbat almashganda yoki tekshirish kerak bo‘lganda',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    label: 'Xatolik',
    description: 'Track code yoki mijoz topilmaganda',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
  },
  duplicate: {
    label: 'Oldin saqlangan',
    description: 'Track code bazada mavjud bo‘lganda',
    icon: Ban,
    color: 'text-orange-600 dark:text-orange-400',
  },
  merge: {
    label: 'Birlashtirish',
    description: 'Ajralgan mijoz guruhlari birlashtirilganda',
    icon: GitMerge,
    color: 'text-violet-600 dark:text-violet-400',
  },
};

function isSupportedAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
}

export function ScannerSoundSettingsModal({
  open,
  onOpenChange,
}: ScannerSoundSettingsModalProps) {
  const [profile, setProfile] = useState<ExpectedCargoSoundProfile>(() =>
    createDefaultExpectedCargoSoundProfile(),
  );
  const [storedFileNames, setStoredFileNames] = useState<
    Partial<Record<ExpectedCargoSoundEvent, string>>
  >({});
  const [stagedFiles, setStagedFiles] = useState<
    Partial<Record<ExpectedCargoSoundEvent, File>>
  >({});
  const [deletedFiles, setDeletedFiles] = useState<Set<ExpectedCargoSoundEvent>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    void initializeExpectedCargoSounds().then(() => {
      if (cancelled) return;
      const cachedProfile = getExpectedCargoSoundProfileSnapshot();
      if (cachedProfile) setProfile(cachedProfile);
      setStoredFileNames(getExpectedCargoCustomSoundNames());
      setStagedFiles({});
      setDeletedFiles(new Set());
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  const customFileNames = useMemo(() => {
    return Object.fromEntries(
      EXPECTED_CARGO_SOUND_EVENTS.flatMap((event) => {
        const stagedName = stagedFiles[event]?.name;
        const storedName = deletedFiles.has(event) ? undefined : storedFileNames[event];
        const name = stagedName ?? storedName;
        return name ? [[event, name]] : [];
      }),
    ) as Partial<Record<ExpectedCargoSoundEvent, string>>;
  }, [deletedFiles, stagedFiles, storedFileNames]);

  const updateEvent = <K extends keyof ExpectedCargoSoundProfile['events'][ExpectedCargoSoundEvent]>(
    event: ExpectedCargoSoundEvent,
    key: K,
    value: ExpectedCargoSoundProfile['events'][ExpectedCargoSoundEvent][K],
  ) => {
    setProfile((current) => ({
      ...current,
      events: {
        ...current.events,
        [event]: { ...current.events[event], [key]: value },
      },
    }));
  };

  const handleFileChange = (event: ExpectedCargoSoundEvent, change: ChangeEvent<HTMLInputElement>) => {
    const file = change.target.files?.[0];
    change.target.value = '';
    if (!file) return;
    if (!isSupportedAudioFile(file)) {
      toast.error('MP3, WAV, OGG, M4A yoki AAC audio fayl tanlang');
      return;
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      toast.error('Audio fayl 15 MB dan katta bo‘lmasligi kerak');
      return;
    }
    setStagedFiles((current) => ({ ...current, [event]: file }));
    setDeletedFiles((current) => {
      const next = new Set(current);
      next.delete(event);
      return next;
    });
    updateEvent(event, 'source', 'custom');
  };

  const removeCustomFile = (event: ExpectedCargoSoundEvent) => {
    setStagedFiles((current) => {
      const next = { ...current };
      delete next[event];
      return next;
    });
    if (storedFileNames[event]) {
      setDeletedFiles((current) => new Set(current).add(event));
    }
    updateEvent(event, 'source', 'default');
  };

  const handleTest = async (event: ExpectedCargoSoundEvent) => {
    if (profile.events[event].source === 'custom' && !customFileNames[event]) {
      toast.warning('Avval audio fayl tanlang');
      return;
    }
    await testExpectedCargoSound(event, profile, stagedFiles[event]);
  };

  const handleSave = async () => {
    const missingCustom = EXPECTED_CARGO_SOUND_EVENTS.find(
      (event) => profile.events[event].source === 'custom' && !customFileNames[event],
    );
    if (missingCustom) {
      toast.warning(`${EVENT_META[missingCustom].label} uchun audio fayl tanlang`);
      return;
    }

    setIsSaving(true);
    try {
      for (const event of deletedFiles) {
        await expectedCargoSoundStorage.deleteCustomSound(event);
      }
      for (const event of EXPECTED_CARGO_SOUND_EVENTS) {
        const file = stagedFiles[event];
        if (file) await expectedCargoSoundStorage.saveCustomSound(event, file);
      }
      await expectedCargoSoundStorage.saveProfile(profile);
      await refreshExpectedCargoSoundCache();
      toast.success('Ovoz sozlamalari shu qurilmaga saqlandi');
      onOpenChange(false);
    } catch {
      toast.error('Ovoz sozlamalarini saqlab bo‘lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Barcha custom ovozlar va sozlamalar o‘chirilsinmi?')) return;
    setIsSaving(true);
    try {
      const resetProfile = await expectedCargoSoundStorage.reset();
      await refreshExpectedCargoSoundCache();
      setProfile(resetProfile);
      setStoredFileNames({});
      setStagedFiles({});
      setDeletedFiles(new Set());
      toast.success('Standart ovozlar tiklandi');
    } catch {
      toast.error('Ovoz sozlamalarini tiklab bo‘lmadi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-5 text-orange-500" />
            Scanner ovozlari
          </DialogTitle>
          <DialogDescription>
            Sozlamalar va audio fayllar faqat shu qurilmada saqlanadi.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-3 py-3 sm:px-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
              Sozlamalar yuklanmoqda...
            </div>
          ) : (
            <div className="divide-y rounded-md border border-zinc-200 dark:border-zinc-800">
              {EXPECTED_CARGO_SOUND_EVENTS.map((event) => {
                const meta = EVENT_META[event];
                const Icon = meta.icon;
                const settings = profile.events[event];
                const fileName = customFileNames[event];
                return (
                  <section key={event} className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                          <Icon className={cn('size-4.5', meta.color)} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {meta.label}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.enabled}
                        onCheckedChange={(checked) => updateEvent(event, 'enabled', checked)}
                        aria-label={`${meta.label} ovozini yoqish`}
                      />
                    </div>

                    <div className={cn(
                      'mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]',
                      !settings.enabled && 'pointer-events-none opacity-45',
                    )}>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold text-zinc-500">Ovoz manbasi</span>
                        <select
                          value={settings.source}
                          onChange={(change) => updateEvent(
                            event,
                            'source',
                            change.target.value as ExpectedCargoSoundSource,
                          )}
                          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="default">Standart</option>
                          {event === 'success' && <option value="ruster">Ruster</option>}
                          <option value="custom">Custom fayl</option>
                        </select>
                      </label>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-500">Ovoz balandligi</span>
                          <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                            {Math.round(settings.volume * 100)}%
                          </span>
                        </div>
                        <div className="flex h-9 items-center gap-2">
                          <Volume2 className="size-4 shrink-0 text-zinc-400" />
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(settings.volume * 100)}
                            onChange={(change) => updateEvent(
                              event,
                              'volume',
                              Number(change.target.value) / 100,
                            )}
                            className="w-full accent-orange-500"
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-end"
                        onClick={() => void handleTest(event)}
                      >
                        <Play className="size-4" />
                        Test
                      </Button>
                    </div>

                    {settings.source === 'custom' && settings.enabled && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-dashed pt-3 sm:flex-row sm:items-center">
                        <input
                          id={`scanner-sound-${event}`}
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                          className="sr-only"
                          onChange={(change) => handleFileChange(event, change)}
                        />
                        <label
                          htmlFor={`scanner-sound-${event}`}
                          className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-bold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <Upload className="size-3.5" />
                          Audio tanlash
                        </label>
                        <span className="min-w-0 flex-1 truncate text-xs text-zinc-500" title={fileName}>
                          {fileName ?? 'Fayl tanlanmagan'}
                        </span>
                        {fileName && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => removeCustomFile(event)}
                          >
                            Olib tashlash
                          </Button>
                        )}
                        <select
                          value={settings.playbackMode}
                          onChange={(change) => updateEvent(
                            event,
                            'playbackMode',
                            change.target.value as ExpectedCargoPlaybackMode,
                          )}
                          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900"
                          title="Yangi scan kelgandagi ijro tartibi"
                        >
                          <option value="restart">Yangisini chalish</option>
                          <option value="finish">Tugaguncha kutish</option>
                        </select>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-zinc-50 px-5 py-3 dark:bg-zinc-900/70">
          <Button type="button" variant="ghost" onClick={() => void handleReset()} disabled={isSaving}>
            <RotateCcw className="size-4" />
            Standartga qaytarish
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={isSaving || isLoading}>
            <Save className="size-4" />
            {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
