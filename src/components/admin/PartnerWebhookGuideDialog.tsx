import { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GUIDE_TELEGRAPH_URL,
  GUIDE_TITLE,
  PARTNER_WEBHOOK_GUIDE,
  guideToMarkdown,
  splitInlineCode,
  type GuideBlock,
} from './partnerWebhookGuide';
import { COURIER_GUIDE_TITLE, PARTNER_COURIER_GUIDE } from './partnerCourierGuide';

const GUIDES = {
  webhook: { title: GUIDE_TITLE, sections: PARTNER_WEBHOOK_GUIDE, telegraph: GUIDE_TELEGRAPH_URL },
  courier: { title: COURIER_GUIDE_TITLE, sections: PARTNER_COURIER_GUIDE, telegraph: null },
} as const;

async function copyText(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} nusxalandi`);
    return true;
  } catch {
    toast.error("Nusxalab bo'lmadi — matnni qo'lda belgilang");
    return false;
  }
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((part, index) =>
        index % 2 === 1 ? (
          <code
            key={index}
            className="rounded-md bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800 [overflow-wrap:anywhere] dark:bg-white/10 dark:text-white/85"
          >
            {part}
          </code>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-[#0d1117] dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-white/45">{lang}</span>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(code, 'Kod')) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Nusxalandi' : 'Nusxalash'}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto p-3 text-[12px] leading-relaxed text-[#e6edf3]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === 'p') {
    return (
      <p className="text-[13px] leading-relaxed text-gray-700 dark:text-white/75">
        <Inline text={block.text} />
      </p>
    );
  }
  if (block.kind === 'list') {
    return (
      <ul className="space-y-1.5 text-[13px] leading-relaxed text-gray-700 dark:text-white/75">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-white/40" />
            <span>
              <Inline text={item} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === 'table') {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] bg-gray-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/[0.04] dark:text-white/45">
          <span>{block.head[0]}</span>
          <span>{block.head[1]}</span>
        </div>
        {block.rows.map(([name, meaning]) => (
          <div
            key={name}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-t border-gray-100 px-3 py-2 text-[12.5px] dark:border-white/[0.06]"
          >
            <span className="break-words font-mono text-gray-900 dark:text-white">{name}</span>
            <span className="text-gray-600 dark:text-white/65">
              <Inline text={meaning} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <CodeBlock lang={block.lang} code={block.code} />;
}

/**
 * What the partner's developer needs to receive our webhooks, readable here
 * and copyable as Markdown to send them (Telegram, Telegraph, e-mail).
 */
export default function PartnerWebhookGuideDialog({
  open,
  onOpenChange,
  guide = 'webhook',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "webhook": import rows we push; "courier": orders they send our courier. */
  guide?: keyof typeof GUIDES;
}) {
  const { title, sections, telegraph } = GUIDES[guide];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-gray-100 px-5 pb-4 pt-5 text-left dark:border-white/10">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base font-black">
            <BookOpen className="h-5 w-5 shrink-0 text-orange-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Hamkor dasturchisiga {telegraph ? 'Telegraph havolasini yoki ' : ''}shu matnni yuboring.
            Maxfiy kalit bu yerda yo'q: uni alohida, xavfsiz kanal orqali bering.
          </DialogDescription>
          {telegraph && (
          <a
            href={telegraph}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-start gap-1.5 break-all rounded-xl border border-gray-200 px-3 py-2 font-mono text-[12px] text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.04]"
          >
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-white/40" />
            {telegraph}
          </a>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {telegraph && (
              <button
                type="button"
                onClick={() => void copyText(telegraph, 'Havola')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-black text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-gray-900"
              >
                <Link2 className="h-3.5 w-3.5" />
                Havolani nusxalash
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyText(guideToMarkdown(sections, title), "Qo'llanma (Markdown)")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-800 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white/85 dark:hover:bg-white/[0.06]"
            >
              <Copy className="h-3.5 w-3.5" />
              Hammasini nusxalash (Markdown)
            </button>
          </div>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto px-5 py-5">
          {sections.map((section, index) => (
            <section key={section.title} className="space-y-2.5">
              <h3 className="flex items-baseline gap-2 text-sm font-black text-gray-900 dark:text-white">
                <span className="font-mono text-[11px] text-gray-400 dark:text-white/35">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section.title}
              </h3>
              {section.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
