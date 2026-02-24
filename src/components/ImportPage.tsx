import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusAnimation from './StatusAnimation';
import { importExcel } from '@/api/services/import';

type DatabaseType = 'uz' | 'china';

export default function ImportPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DatabaseType>('china');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
    } else {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.invalidFile'));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
    } else {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.invalidFile'));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      setSubmitStatus('error');
      setSubmitMessage(t('import.messages.invalidFile'));
      return;
    }

    setSubmitStatus('loading');
    setSubmitMessage(t('import.messages.loading'));

    try {
      // API orqali import qilish
      const response = await importExcel(selectedFile, activeTab);

      setSubmitStatus('success');
      setSubmitMessage(response.message || t('import.messages.success'));
      setSelectedFile(null);

      // 2 soniyadan keyin Telegram ni yopish
      setTimeout(() => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.close();
        }
      }, 2000);

    } catch (error: unknown) {
      console.error('Import error:', error);
      const errorMessage =
        (typeof error === 'object' && error !== null && 'message' in (error as object) && (error as { message?: string }).message) ||
        t('import.messages.error');

      setSubmitStatus('error');
      setSubmitMessage(errorMessage);
    }
  };

  const handleAnimationComplete = () => {
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  const handleTabChange = (tab: DatabaseType) => {
    setActiveTab(tab);
    setSelectedFile(null); // Tab o'zgarganda faylni tozalash
  };

  return (
    <>
      {/* Status Animation */}
      {submitStatus !== 'idle' && (
        <StatusAnimation
          status={submitStatus}
          message={submitMessage}
          onComplete={handleAnimationComplete}
        />
      )}

      <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-orange-100 relative overflow-hidden">
          {/* Decorative blur effects */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-orange-300/20 rounded-full blur-3xl -z-10 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-300/20 rounded-full blur-3xl -z-10 animate-pulse animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-200/10 rounded-full blur-3xl -z-10 animate-pulse animation-delay-4000" />

          {/* Header */}
          <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full mb-4 shadow-lg">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent mb-2">
              {t('import.title')}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 relative z-10">
            <button
              type="button"
              onClick={() => handleTabChange('uz')}
              className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'uz'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-[1.02]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('import.uzDatabase')}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('china')}
              className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'china'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg transform scale-[1.02]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('import.chinaDatabase')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {/* File Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`group relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 backdrop-blur-sm ${
                isDragging
                  ? 'border-orange-500 bg-orange-50/50 scale-[1.02] shadow-lg'
                  : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/30'
              }`}
            >
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              <div className="flex flex-col items-center text-center pointer-events-none relative z-0">
                <div className={`mb-4 transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {selectedFile ? (
                    <div className="relative">
                      <FileSpreadsheet className="w-16 h-16 text-green-500" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <Upload className="w-16 h-16 text-orange-500" />
                  )}
                </div>

                {selectedFile ? (
                  <>
                    <p className="text-lg font-semibold text-gray-800 mb-1">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-gray-800 mb-2">
                      {t('import.dragDropFile')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('import.selectFilePlaceholder')}
                    </p>
                  </>
                )}
              </div>

              {/* Inner blur effects */}
              <div className="absolute top-2 left-2 w-24 h-24 bg-orange-400/10 rounded-full blur-2xl -z-10" />
              <div className="absolute bottom-2 right-2 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl -z-10" />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!selectedFile || submitStatus === 'loading'}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {t('import.submit')}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
