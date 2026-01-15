import type { VantaEffect, VantaEffectFactory } from './types';

// Declare p5 global type for the scope of this file
declare const p5: any;

export const stickman: VantaEffectFactory = (options) => {
    const el = (options as any).el as HTMLElement;
    let p5Instance: any;

    const sketch = (p: any) => {
        const stickmen: Stickman[] = [];

        p.setup = () => {
            p.createCanvas(el.offsetWidth, el.offsetHeight);
            p.colorMode(p.HSB);
            // Create a crowd
            for (let i = 0; i < 20; i++) {
                stickmen.push(new Stickman(p));
            }
        };

        p.draw = () => {
            p.background(0); // Black background

            // Update and draw each stickman
            for (const man of stickmen) {
                man.update();
                man.display();
            }
        };

        p.windowResized = () => {
            p.resizeCanvas(el.offsetWidth, el.offsetHeight);
        };
    };

    class Stickman {
        p: any;
        x: number;
        y: number;
        size: number;
        hue: number;
        speed: number;
        offset: number;

        constructor(p: any) {
            this.p = p;
            this.x = p.random(p.width);
            this.y = p.random(p.height);
            this.size = p.random(30, 60);
            this.hue = p.random(360);
            this.speed = p.random(0.02, 0.05);
            this.offset = p.random(1000);
        }

        update() {
            // Wandering movement
            this.x += this.p.map(this.p.noise(this.offset + this.p.frameCount * 0.01), 0, 1, -2, 2);
            this.y += this.p.map(this.p.noise(this.offset + 100 + this.p.frameCount * 0.01), 0, 1, -2, 2);

            // Wrap around edges
            if (this.x < -50) this.x = this.p.width + 50;
            if (this.x > this.p.width + 50) this.x = -50;
            if (this.y < -50) this.y = this.p.height + 50;
            if (this.y > this.p.height + 50) this.y = -50;
        }

        display() {
            const { p } = this;
            p.stroke(this.hue, 80, 100);
            p.strokeWeight(4);
            p.noFill();

            // Head
            p.circle(this.x, this.y, this.size);

            // Body
            const bodyLen = this.size * 1.5;
            p.line(this.x, this.y + this.size / 2, this.x, this.y + this.size / 2 + bodyLen);

            // Center point for limbs
            const shoulderY = this.y + this.size / 2 + bodyLen * 0.2;
            const hipY = this.y + this.size / 2 + bodyLen;

            // Arms (waving)
            const armLen = this.size;
            const armAngle1 = p.sin(p.frameCount * this.speed + this.offset) * 1;
            const armAngle2 = p.cos(p.frameCount * this.speed + this.offset) * 1;

            this.drawLimb(this.x, shoulderY, armLen, armAngle1 + p.PI / 4); // Left arm
            this.drawLimb(this.x, shoulderY, armLen, -armAngle2 - p.PI / 4, true); // Right arm

            // Legs (walking)
            const legLen = this.size * 1.2;
            const legAngle1 = p.sin(p.frameCount * this.speed * 2 + this.offset) * 0.5;
            const legAngle2 = p.cos(p.frameCount * this.speed * 2 + this.offset) * 0.5;

            this.drawLimb(this.x, hipY, legLen, legAngle1 + p.PI / 6);
            this.drawLimb(this.x, hipY, legLen, -legAngle2 - p.PI / 6, true);
        }

        drawLimb(originX: number, originY: number, len: number, angle: number, mirror = false) {
            const { p } = this;
            const endX = originX + (mirror ? -1 : 1) * p.sin(angle) * len;
            const endY = originY + p.cos(angle) * len;
            p.line(originX, originY, endX, endY);
        }
    }

    // Check if p5 is globally available (it should be due to ensureP5 in catalog)
    if (typeof p5 !== 'undefined') {
        p5Instance = new p5(sketch, el);
    } else {
        console.error('p5 is not loaded!');
    }

    return {
        destroy() {
            p5Instance?.remove();
        }
    } as VantaEffect;
};

export default stickman;
