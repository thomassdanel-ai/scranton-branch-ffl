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
    <div className="modal">
      <div className="modal__backdrop" onClick={onCancel} />
      <div className="modal__dialog">
        <h3 className="modal__title">{title}</h3>
        <p className="modal__body">{message}</p>
        <div className="modal__actions">
          <button onClick={onCancel} className="btn btn--ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
