import {quality} from '../src/performance/quality';
quality.mobile=true;
await import('./boundary-extrusion');
await import('./cheese-web-shape');
await import('./slice-seams');
console.log('PASS: mobile geometry preserves closed cheese, clumping, anchors, reset and slice joins.');
