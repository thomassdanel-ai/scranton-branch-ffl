'use client';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'safe';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ title, message, confirmLabel, cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative glass-card p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-text-secondary text-sm">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-muted hover:text-white border border-white/10 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg font-semibold transition-colors ${
              variant === 'danger'
                ? 'bg-accent-red hover:bg-red-600'
                : 'bg-accent-green hover:bg-green-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
