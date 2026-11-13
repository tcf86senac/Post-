import React from 'react';
import { PinColor } from '../types';

interface PushPinProps {
  color?: PinColor;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PIN_COLORS: Record<
  PinColor,
  {
    primary: string;
    secondary: string;
    highlight: string;
    shadow: string;
  }
> = {
  red: {
    primary: '#DC2626',
    secondary: '#991B1B',
    highlight: '#F87171',
    shadow: 'rgba(153, 27, 27, 0.6)',
  },
  blue: {
    primary: '#2563EB',
    secondary: '#1E40AF',
    highlight: '#60A5FA',
    shadow: 'rgba(30, 64, 175, 0.6)',
  },
  yellow: {
    primary: '#EAB308',
    secondary: '#A16207',
    highlight: '#FDE047',
    shadow: 'rgba(161, 98, 7, 0.6)',
  },
  green: {
    primary: '#16A34A',
    secondary: '#166534',
    highlight: '#4ADE80',
    shadow: 'rgba(22, 101, 52, 0.6)',
  },
  purple: {
    primary: '#9333EA',
    secondary: '#6B21A8',
    highlight: '#C084FC',
    shadow: 'rgba(107, 33, 168, 0.6)',
  },
  silver: {
    primary: '#64748B',
    secondary: '#334155',
    highlight: '#CBD5E1',
    shadow: 'rgba(51, 65, 85, 0.6)',
  },
};

export const PushPin: React.FC<PushPinProps> = ({
  color = 'red',
  className = '',
  size = 'md',
}) => {
  const c = PIN_COLORS[color] || PIN_COLORS.red;

  const width = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;
  const height = size === 'sm' ? 24 : size === 'lg' ? 34 : 28;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      title="Alfinete de fixação no mural"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 24 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(1.5px 3px 2px rgba(0, 0, 0, 0.35))',
        }}
      >
        <defs>
          {/* Pushpin Cap Radial Gradient */}
          <radialGradient
            id={`pin-cap-${color}`}
            cx="35%"
            cy="30%"
            r="65%"
            fx="30%"
            fy="25%"
          >
            <stop offset="0%" stopColor={c.highlight} />
            <stop offset="55%" stopColor={c.primary} />
            <stop offset="100%" stopColor={c.secondary} />
          </radialGradient>

          {/* Pin Stem Linear Gradient */}
          <linearGradient id={`pin-stem-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c.secondary} />
            <stop offset="35%" stopColor={c.primary} />
            <stop offset="65%" stopColor={c.highlight} />
            <stop offset="100%" stopColor={c.secondary} />
          </linearGradient>

          {/* Metallic Needle Gradient */}
          <linearGradient id="pin-needle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Paper Puncture Hole Shadow at the base */}
        <ellipse cx="12" cy="27.5" rx="3" ry="1.2" fill="rgba(0,0,0,0.4)" />

        {/* Metallic Needle entering the paper */}
        <path
          d="M10.8 21.5 L12 28 L13.2 21.5 Z"
          fill="url(#pin-needle)"
        />

        {/* Pushpin Lower Flange */}
        <path
          d="M8.5 19.5 C8.5 18.5 15.5 18.5 15.5 19.5 C15.5 20.8 8.5 20.8 8.5 19.5 Z"
          fill={`url(#pin-cap-${color})`}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="0.5"
        />

        {/* Pushpin Narrow Waist / Stem */}
        <path
          d="M9.8 11.5 L8.8 19.2 C11 19.8 13 19.8 15.2 19.2 L14.2 11.5 Z"
          fill={`url(#pin-stem-${color})`}
        />

        {/* Pushpin Upper Collar */}
        <ellipse
          cx="12"
          cy="11.5"
          rx="3.5"
          ry="1.2"
          fill={`url(#pin-cap-${color})`}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.4"
        />

        {/* Pushpin Rounded Cap Body */}
        <ellipse
          cx="12"
          cy="7"
          rx="6"
          ry="5"
          fill={`url(#pin-cap-${color})`}
        />

        {/* 3D Specular Highlight on Top Cap */}
        <ellipse
          cx="10"
          cy="5"
          rx="2.2"
          ry="1.4"
          fill="rgba(255, 255, 255, 0.75)"
        />
        <circle
          cx="9.2"
          cy="4.5"
          r="0.8"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
};
