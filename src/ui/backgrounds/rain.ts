import type { VantaEffectFactory } from './types';

declare const p5: any;

export const rain: VantaEffectFactory = (options) => {
    const el = (options as any).el as HTMLElement;
    let p5Instance: any;

    const sketch = (p: any) => {
        const drops: Drop[] = [];

        p.setup = () => {
            p.createCanvas(el.offsetWidth, el.offsetHeight);
            for (let i = 0; i < 100; i++) {
                drops.push(new Drop(p));
            }
        };

        p.draw = () => {
            p.background(10, 10, 30, 50); // Dark blue background
            for (const drop of drops) {
                drop.fall();
                drop.show();
            }
        };

        p.windowResized = () => {
            p.resizeCanvas(el.offsetWidth, el.offsetHeight);
        };
    };

    class Drop {
        p: any;
        x: number;
        y: number;
        z: number;
        len: number;
        yspeed: number;

        constructor(p: any) {
            this.p = p;
            this.x = p.random(p.width);
            this.y = p.random(-500, -50);
            this.z = p.random(0, 20);
            this.len = p.map(this.z, 0, 20, 10, 20);
            this.yspeed = p.map(this.z, 0, 20, 4, 10);
        }

        fall() {
            this.y += this.yspeed;
            const grav = this.p.map(this.z, 0, 20, 0, 0.2);
            this.yspeed += grav;

            if (this.y > this.p.height) {
                this.y = this.p.random(-200, -100);
                this.yspeed = this.p.map(this.z, 0, 20, 4, 10);
            }
        }

        show() {
            const thick = this.p.map(this.z, 0, 20, 1, 3);
            this.p.strokeWeight(thick);
            this.p.stroke(138, 43, 226); // Purple rain
            this.p.line(this.x, this.y, this.x, this.y + this.len);
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

export default rain;
