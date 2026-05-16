import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BottomSheet({ open, onClose, children, testId = 'bottom-sheet' }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {onClose && (
            <motion.div
              className="absolute inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              data-testid={`${testId}-backdrop`}
            />
          )}
          <motion.div
            data-testid={testId}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute left-0 right-0 bottom-0 z-50 bg-white dark:bg-ink-900 rounded-t-3xl shadow-floating dark:shadow-floating-dark px-5 pb-6 pt-3 max-h-[85%] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-ink-200 dark:bg-ink-800 rounded-full mx-auto mb-4" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
