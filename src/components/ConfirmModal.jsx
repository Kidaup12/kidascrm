import React from 'react';
import Modal from './Modal';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', confirmColor = 'btn-primary' }) {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    // If default primary, let's force an error look if it's a 'Delete' action, 
    // unless they passed 'btn-success' etc.
    const isError = confirmText.toLowerCase() === 'delete' && confirmColor === 'btn-primary';
    const finalColorClass = isError ? 'btn-danger' : confirmColor;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="400px"
            footerActions={
                <>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button 
                        className={`btn ${finalColorClass}`} 
                        style={isError ? { backgroundColor: 'var(--color-error)', color: 'white', borderColor: 'var(--color-error)' } : {}}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                </>
            }
        >
            <p className="text-secondary mb-0">{message}</p>
        </Modal>
    );
}
