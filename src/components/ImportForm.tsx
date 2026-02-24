import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusAnimation from './StatusAnimation';

type DatabaseType = 'uz' | 'china';

interface ImportFormProps {
  databaseType: DatabaseType;
}

export default function ImportForm({ databaseType }: ImportFormProps) {
  const { t } = useTranslation();
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
      const formData = new FormData();
      formData.append('excel_file', selectedFile);
      formData.append('database_type', databaseType);

      // TODO: API endpointni qo'shish kerak
      // const response = await importExcelApi(formData, databaseType);

      // Hozircha mock success
      await new Promise(resolve => setTimeout(resolve, 2000));

      setSubmitStatus('success');
      setSubmitMessage(t('import.messages.success'));
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

  const getDatabaseTitle = () => {
    return databaseType === 'uz' ? t('import.uzDatabase') : t('import.chinaDatabase');
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
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-orange-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full mb-4 shadow-lg">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent mb-2">
              {t('import.title')}
            </h1>
            <p className="text-gray-600 font-medium text-lg">
              {getDatabaseTitle()}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`group relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
                isDragging
                  ? 'border-orange-500 bg-orange-50/50 scale-[1.02]'
                  : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/30'
              }`}
            >
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className="flex flex-col items-center text-center pointer-events-none">
                <div className={`mb-4 transition-transform duration-300 ${isDragging ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {selectedFile ? (
                    <FileSpreadsheet className="w-16 h-16 text-green-500" />
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

              {/* Decorative blur effects */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-orange-300/20 rounded-full blur-3xl -z-10 animate-pulse" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-300/20 rounded-full blur-3xl -z-10 animate-pulse animation-delay-2000" />
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
