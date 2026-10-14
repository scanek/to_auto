import { useEffect } from 'react';

interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
}

/**
 * Reusable modal accessibility hook:
 * 1. Handles Escape key down to trigger onClose
 * 2. Prevents background page scrolling while modal is open
 * 3. Restores overflow state on unmount / close
 */
export function useModalA11y({
  isOpen,
  onClose,
  closeOnEscape = true,
  lockScroll = true,
}: UseModalA11yOptions) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let originalOverflow = '';
    if (lockScroll) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (lockScroll) {
        document.body.style.overflow = originalOverflow;
      }
    };
  }, [isOpen, onClose, closeOnEscape, lockScroll]);
}
