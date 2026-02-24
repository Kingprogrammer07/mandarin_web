import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


interface InfoRowProps {
    label: string;
    value: string;
    copyable?: boolean;
    className?: string; // Add className prop
}

export const InfoRow = ({ label, value, copyable = true, className }: InfoRowProps) => { // Use className parameter
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        // Assuming you have a toast library like sonner or use-toast set up elsewhere, 
        // but for now we'll just handle the visual state.
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={cn("flex items-center justify-between p-4 bg-white/60 dark:bg-white/5 rounded-xl border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-sm", className)}>
            <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium mb-1">{label}</span>
                <span className="text-sm font-semibold text-foreground break-all">{value}</span>
            </div>
            {copyable && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-full transition-colors"
                    onClick={handleCopy}
                >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
            )}
        </div>
    );
};
