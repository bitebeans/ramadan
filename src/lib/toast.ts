// Lightweight in-app toast notification system — no external deps
export type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ToastOptions {
    type?: ToastType;
    duration?: number;
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: '#ECFDF5', border: '#10B981', icon: '✅' },
    error: { bg: '#FEF2F2', border: '#EF4444', icon: '❌' },
    warning: { bg: '#FFFBEB', border: '#F59E0B', icon: '⚠️' },
    info: { bg: '#EFF6FF', border: '#3B82F6', icon: 'ℹ️' },
};

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
    if (!container || !document.body.contains(container)) {
        container = document.createElement('div');
        container.id = 'bb-toast-container';
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: '99999',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            pointerEvents: 'none',
            maxWidth: '380px',
            width: 'calc(100vw - 3rem)',
        });
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message: string, options: ToastOptions = {}) {
    const { type = 'info', duration = 4000 } = options;
    const colors = COLORS[type];

    const el = document.createElement('div');
    Object.assign(el.style, {
        backgroundColor: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '0.875rem 1rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        pointerEvents: 'all',
        opacity: '0',
        transform: 'translateY(20px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: '#111827',
        lineHeight: '1.4',
        cursor: 'pointer',
        fontFamily: 'inherit',
    });

    el.innerHTML = `<span style="font-size:1.1rem;flex-shrink:0">${colors.icon}</span><span>${message}</span>`;
    el.addEventListener('click', () => dismiss());

    const ctr = getContainer();
    ctr.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    });

    const dismiss = () => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => el.remove(), 300);
    };

    const timer = setTimeout(dismiss, duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => setTimeout(dismiss, 1500));
}
