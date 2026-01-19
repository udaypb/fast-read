import type { VantaEffectFactory } from './types';

declare const p5: any;

export const dotWave: VantaEffectFactory = (options) => {
    const el = (options as any).el as HTMLElement;
    let p5Instance: any;

    const sketch = (p: any) => {
        const spacing = 30;
        const dotSize = 2.5;

        p.setup = () => {
            p.createCanvas(el.offsetWidth, el.offsetHeight);
            p.noStroke();
        };

        p.draw = () => {
            p.background(255); // Pure white
            p.fill(200); // Subtle grey for dots

            for (let x = 0; x < p.width + spacing; x += spacing) {
                for (let y = 0; y < p.height + spacing; y += spacing) {
                    // Wave logic: left to right motion
                    // sin(time + x_position) creates a wave that moves horizontally
                    const wave = p.sin(p.frameCount * 0.03 + x * 0.01 + y * 0.005);
                    const offsetY = wave * 15;
                    const opacity = p.map(wave, -1, 1, 150, 255);

                    p.fill(180, 180, 180, opacity);
                    p.circle(x, y + offsetY, dotSize);
                }
            }
        };

        p.windowResized = () => {
            p.resizeCanvas(el.offsetWidth, el.offsetHeight);
        };
    };

    if (typeof p5 !== 'undefined') {
        p5Instance = new p5(sketch, el);
    }

    return {
        destroy() {
            p5Instance?.remove();
        }
    };
};

export default dotWave;
