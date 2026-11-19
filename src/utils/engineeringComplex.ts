export interface ComplexValue { re: number; im: number }

export const complex = (re: number, im = 0): ComplexValue => ({ re, im });
export const magnitude = (z: ComplexValue) => Math.hypot(z.re, z.im);
export const addComplex = (a: ComplexValue, b: ComplexValue) => complex(a.re + b.re, a.im + b.im);
export const subtractComplex = (a: ComplexValue, b: ComplexValue) => complex(a.re - b.re, a.im - b.im);
export const scaleComplex = (a: ComplexValue, k: number) => complex(a.re * k, a.im * k);
export const multiplyComplex = (a: ComplexValue, b: ComplexValue) => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

export function divideComplex(a: ComplexValue, b: ComplexValue): ComplexValue {
  if (b.im === 0) return complex(a.re / b.re, a.im / b.re);
  // Normalize the divisor first; squaring its components can overflow or underflow.
  const size = Math.max(Math.abs(b.re), Math.abs(b.im));
  const c = b.re / size;
  const d = b.im / size;
  const norm = c * c + d * d;
  const re = a.re / size / norm;
  const im = a.im / size / norm;
  return complex(re * c + im * d, im * c - re * d);
}

export function sqrtComplex(z: ComplexValue): ComplexValue {
  if (!z.im) return z.re < 0 ? complex(0, Math.sqrt(-z.re)) : complex(Math.sqrt(z.re));
  const halfMagnitude = Math.hypot(z.re / 2, z.im / 2);
  const t = Math.sqrt(halfMagnitude + Math.abs(z.re) / 2);
  return z.re >= 0 ? complex(t, z.im / (2 * t)) : complex(Math.abs(z.im) / (2 * t), Math.sign(z.im) * t);
}

export function powerComplex(a: ComplexValue, b: ComplexValue): ComplexValue {
  if (!b.im && Number.isInteger(b.re) && Math.abs(b.re) <= 2048) {
    let result = complex(1);
    let base = b.re < 0 ? divideComplex(complex(1), a) : a;
    for (let n = Math.abs(b.re); n; n = Math.floor(n / 2)) {
      if (n % 2) result = multiplyComplex(result, base);
      if (n > 1) base = multiplyComplex(base, base);
    }
    return result;
  }
  if (!a.im && !b.im && (a.re >= 0 || Number.isInteger(b.re))) return complex(a.re ** b.re);
  if (b.re === 0.5 && !b.im) return sqrtComplex(a);
  const arg = Math.atan2(a.im || 0, a.re);
  const log = Math.log(magnitude(a));
  const radius = Math.exp(b.re * log - b.im * arg);
  const phase = b.re * arg + b.im * log;
  return complex(radius * Math.cos(phase), radius * Math.sin(phase));
}
