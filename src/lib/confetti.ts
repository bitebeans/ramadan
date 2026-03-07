// Canvas-based confetti burst — no external dependencies
const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    angle: number;
    angleSpeed: number;
    opacity: number;
    shape: 'rect' | 'circle';
}

export function fireConfetti(duration = 2200) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
    position:fixed;top:0;left:0;width:100vw;height:100vh;
    pointer-events:none;z-index:99998;
  `;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    const particles: Particle[] = [];

    // Burst from center-top area
    for (let i = 0; i < 120; i++) {
        const angle = (Math.random() * Math.PI) - Math.PI / 2; // mostly upward fan
        const speed = 6 + Math.random() * 12;
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: canvas.height * 0.35,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 4,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            size: 6 + Math.random() * 8,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: (Math.random() - 0.5) * 0.3,
            opacity: 1,
            shape: Math.random() > 0.5 ? 'rect' : 'circle',
        });
    }

    const start = performance.now();

    const draw = (now: number) => {
        const elapsed = now - start;
        if (elapsed > duration) {
            canvas.remove();
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.vy += 0.3; // gravity
            p.vx *= 0.99; // drag
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.angleSpeed;
            p.opacity = Math.max(0, 1 - elapsed / duration);

            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
}
