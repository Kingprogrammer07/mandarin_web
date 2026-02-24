import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plane, X, ArrowRight, Calendar } from 'lucide-react';

interface NewReportsModalProps {
    isOpen: boolean;
    onClose: () => void;
    flights: string[];
    onViewAll: () => void;
}

export function NewReportsModal({ isOpen, onClose, flights, onViewAll }: NewReportsModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-white dark:bg-[#1a1612] border border-orange-500/20 rounded-3xl shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Decorative Header Background */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-orange-400/20 via-amber-500/10 to-transparent pointer-events-none" />

                        <div className="relative p-6">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>

                            {/* Icon & Title */}
                            <div className="mb-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-500/20 dark:to-amber-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-inner mb-4">
                                    <Plane className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                                    Yangi Hisobotlar!
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
                                    Sizda {flights.length} ta yangi reys hisoboti mavjud
                                </p>
                            </div>

                            {/* Flight List (Preview) */}
                            <div className="space-y-3 mb-6 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                {flights.slice(0, 3).map((flight, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-gray-900 dark:text-white">{flight}</span>
                                        </div>
                                    </div>
                                ))}
                                {flights.length > 3 && (
                                    <p className="text-center text-xs text-gray-400 font-medium italic">
                                        va yana {flights.length - 3} ta reys...
                                    </p>
                                )}
                            </div>

                            {/* Action Button */}
                            <Button
                                onClick={onViewAll}
                                className="w-full h-12 rounded-xl text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                            >
                                Ko'rish
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
