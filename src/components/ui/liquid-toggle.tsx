"use client";

import React from 'react';
import { cn } from '@/lib/utils';

const styles = {
  switch: `relative block cursor-pointer h-7 w-[46px]
    [--c-active:#275EFE]
    [--c-success:#10B981]
    [--c-warning:#F59E0B]
    [--c-danger:#EF4444]
    [--c-active-inner:#FFFFFF]
    [--c-default:#27272a]
    [--c-default-dark:#3f3f46]
    [--c-black:#1B1B22]
    [transform:translateZ(0)]
    [-webkit-transform:translateZ(0)]
    [backface-visibility:hidden]
    [-webkit-backface-visibility:hidden]
    [perspective:1000]
    [-webkit-perspective:1000]`,
  input: `h-full w-full cursor-pointer appearance-none rounded-full
    bg-[--c-default] outline-none transition-colors duration-500
    hover:bg-[--c-default-dark]
    border border-white/10
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]
    data-[checked=true]:bg-[--c-background]`,
  svg: `pointer-events-none absolute inset-0 fill-white
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]`,
  circle: `transform-gpu transition-transform duration-500
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]
    [backface-visibility:hidden]
    [-webkit-backface-visibility:hidden]`,
  dropCircle: `transform-gpu transition-transform duration-700
    [transform:translate3d(0,0,0)]
    [-webkit-transform:translate3d(0,0,0)]`
};

const variantStyles = {
  default: '[--c-background:var(--c-active)]',
  success: '[--c-background:var(--c-success)]',
  warning: '[--c-background:var(--c-warning)]',
  danger: '[--c-background:var(--c-danger)]',
};

export interface ToggleProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function Toggle({ 
  checked = false, 
  onCheckedChange, 
  className,
  variant = 'default'
}: ToggleProps) {
  const [isChecked, setIsChecked] = React.useState(checked);

  React.useEffect(() => {
    setIsChecked(checked);
  }, [checked]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsChecked(e.target.checked);
    onCheckedChange?.(e.target.checked);
  };

  return (
    <label className={cn(styles.switch, className)}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        data-checked={isChecked}
        className={cn(styles.input, variantStyles[variant])}
      />
      <svg
        viewBox="0 0 52 32"
        filter="url(#goo)"
        className={styles.svg}
      >
        <circle
          className={styles.circle}
          cx="16"
          cy="16"
          r="10"
          style={{
            transformOrigin: '16px 16px',
            transform: `translateX(${isChecked ? '12px' : '0px'}) scale(${isChecked ? '0' : '1'})`,
          }}
        />
        <circle
          className={styles.circle}
          cx="36"
          cy="16"
          r="10"
          style={{
            transformOrigin: '36px 16px',
            transform: `translateX(${isChecked ? '0px' : '-12px'}) scale(${isChecked ? '1' : '0'})`,
          }}
        />
        {isChecked && (
          <circle
            className={styles.dropCircle}
            cx="35"
            cy="-1"
            r="2.5"
          />
        )}
      </svg>
    </label>
  );
}

export function GooeyFilter() {
  return (
    <svg className="fixed w-0 h-0 pointer-events-none opacity-0">
      <defs>
        <filter id="goo">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation="2"
            result="blur"
          />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite
            in="SourceGraphic"
            in2="goo"
            operator="atop"
          />
        </filter>
      </defs>
    </svg>
  );
}
