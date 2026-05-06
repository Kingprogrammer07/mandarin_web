import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Check, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRESET_COLORS } from './types';
import { inputClass } from './utils';

interface ColorPickerFieldProps {
  value:    string;
  onChange: (hex: string) => void;
  error?:   boolean;
}

export function ColorPickerField({ value, onChange, error }: ColorPickerFieldProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [hexInput, setHexInput]     = useState(value);
  const nativePickerRef             = useRef<HTMLInputElement>(null);

  // Keep hex input in sync when value changes externally (e.g. preset click)
  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const isPreset = PRESET_COLORS.some((c) => c.hex === value.toLowerCase());

  const handlePresetClick = (hex: string) => {
    onChange(hex);
    setShowCustom(false);
  };

  const handleHexInputChange = (raw: string) => {
    setHexInput(raw);
    // Apply only when a full valid hex is typed
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      onChange(raw);
    }
  };

  // Native color picker — update form value on every change (no "OK" step)
  const handleNativePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    onChange(hex);
    setHexInput(hex);
  };

  return (
    <div className="space-y-2">
      {/* Preset palette */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => {
          const isSelected = value.toLowerCase() === c.hex;
          return (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              onClick={() => handlePresetClick(c.hex)}
              className={`group flex flex-col items-center gap-1 transition-transform hover:scale-110 ${
                isSelected ? 'scale-110' : ''
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-orange-500 shadow-md shadow-orange-500/30'
                    : 'border-gray-200 dark:border-white/[0.1] hover:border-gray-300'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <span className="flex items-center justify-center w-full h-full">
                    <Check
                      className="w-3 h-3"
                      style={{ color: c.hex === '#ffffff' || c.hex === '#f8fafc' ? '#000' : '#fff' }}
                    />
                  </span>
                )}
              </span>
              <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none max-w-[28px] truncate">
                {c.name}
              </span>
            </button>
          );
        })}

        {/* Custom colour toggle */}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`flex flex-col items-center gap-1 group transition-transform hover:scale-110 ${
            showCustom || (!isPreset && value) ? 'scale-110' : ''
          }`}
        >
          <span
            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
              showCustom || (!isPreset && value)
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/20'
                : 'border-dashed border-gray-300 dark:border-white/[0.15] hover:border-gray-400 bg-gray-50 dark:bg-white/[0.03]'
            }`}
            style={!isPreset && value ? { backgroundColor: value } : undefined}
          >
            {(!isPreset && value) ? (
              <Check
                className="w-3 h-3"
                style={{ color: value === '#ffffff' || value === '#f8fafc' ? '#000' : '#fff' }}
              />
            ) : (
              <Palette className="w-3 h-3 text-gray-400 dark:text-gray-500" />
            )}
          </span>
          <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none">
            Maxsus
          </span>
        </button>
      </div>

      {/* Custom colour editor */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.08]">
              {/* Native colour picker — clicking swatch opens browser picker immediately */}
              <input
                ref={nativePickerRef}
                type="color"
                value={value.match(/^#[0-9a-fA-F]{6}$/) ? value : '#ffffff'}
                onChange={handleNativePickerChange}
                className="w-10 h-10 rounded-lg border border-gray-200 dark:border-white/[0.08] cursor-pointer bg-transparent p-0.5 shrink-0"
                title="Rang tanlang"
              />
              {/* Hex text input — live sync with no separate "OK" step */}
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexInputChange(e.target.value)}
                placeholder="#ffffff"
                maxLength={7}
                className={`${inputClass} flex-1 font-mono ${error ? 'border-red-400' : ''}`}
              />
              {/* Live swatch preview */}
              <span
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/[0.08] shrink-0 transition-colors"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ccc' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
