import type { VantaEffectFactory } from './types';

// Declare p5 global type for the scope of this file
declare const p5: any;

export const blobs: VantaEffectFactory = (options) => {
    const el = (options as any).el as HTMLElement;
    let p5Instance: any;

    const sketch = (p: any) => {
        const blobs: Blob[] = [];

        p.setup = () => {
            p.createCanvas(el.offsetWidth, el.offsetHeight);
            p.colorMode(p.HSB);
            p.noStroke();
            for (let i = 0; i < 15; i++) {
                blobs.push(new Blob(p));
            }
        };

        p.draw = () => {
            p.background(240, 50, 20, 0.1); // Trail effect
            for (const blob of blobs) {
                blob.update();
                blob.display();
            }
        };

        p.windowResized = () => {
            p.resizeCanvas(el.offsetWidth, el.offsetHeight);
        };
    };

    class Blob {
        p: any;
        x: number;
        y: number;
        d: number;
        vx: number;
        vy: number;
        hue: number;

        constructor(p: any) {
            this.p = p;
            this.x = p.random(p.width);
            this.y = p.random(p.height);
            this.d = p.random(50, 150);
            this.vx = p.random(-2, 2);
            this.vy = p.random(-2, 2);
            this.hue = p.random(360);
        }

        update() {
            const { p } = this;
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > p.width) this.vx *= -1;
            if (this.y < 0 || this.y > p.height) this.vy *= -1;
        }

        display() {
            const { p } = this;
            p.fill(this.hue, 80, 90, 0.7);
            p.circle(this.x, this.y, this.d);
        }
    }

    if (typeof p5 !== 'undefined') {
        p5Instance = new p5(sketch, el);
    }

    return {
        destroy() {
            p5Instance?.remove();
        }
    };
};

export default blobs;
