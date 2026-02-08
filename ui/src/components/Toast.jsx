import React, { useState, useCallback } from 'react';
import { Icon } from 'fontnotawesome';

export function useToast(duration = 2500) {
    const [toast, setToast] = useState(null);

    const show = useCallback((message, type = 'success') => {
        setToast({ message, type, key: Date.now() });
        setTimeout(() => setToast(null), duration);
    }, [duration]);

    return { toast, show };
}

export function Toast({ toast }) {
    if (!toast) return null;
    const isSuccess = toast.type === 'success';
    return (
        <div className="toast" key={toast.key} style={{
            background: isSuccess ? 'var(--green-bg)' : 'var(--red-bg)',
            borderColor: isSuccess ? 'rgba(0,214,143,0.25)' : 'rgba(255,83,112,0.25)',
            color: isSuccess ? 'var(--green)' : 'var(--red)',
        }}>
            <Icon icon={isSuccess ? 'check' : 'xmark'} style={{ fontSize: 11 }} />
            {toast.message}
        </div>
    );
}
