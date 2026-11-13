import React from 'react';

interface PostLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const PostLogo: React.FC<PostLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const dimensions = {
    sm: { text: 'text-[22px]', card: 'w-7 h-7', gap: 'gap-1' },
    md: { text: 'text-[27px]', card: 'w-8 h-8', gap: 'gap-1.5' },
    lg: { text: 'text-4xl', card: 'w-11 h-11', gap: 'gap-2' },
    xl: { text: 'text-6xl', card: 'w-16 h-16', gap: 'gap-3' },
  }[size];

  return (
    <div className={`inline-flex items-center ${dimensions.gap} select-none ${className}`}>
      {showText && (
        <span
          className={`${dimensions.text} font-normal leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]`}
          style={{
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            letterSpacing: '-0.055em',
          }}
        >
          Post
        </span>
      )}

      {/* Tilted Yellow Sticky Note with Bottom-Right Curl & Discontinuous Green Cross */}
      <div
        className={`relative ${dimensions.card} shrink-0 rotate-[4deg] transition-transform hover:rotate-0 hover:scale-105 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)]`}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Post+ Yellow Note Paper (#FEE725) */}
          <path
            d="M 10 3 L 90 3 Q 97 3 97 10 L 97 67 C 97 80 81 97 67 97 L 10 97 Q 3 97 3 90 L 3 10 Q 3 3 10 3 Z"
            fill="#FEE725"
          />

          {/* Curled Bottom-Right Corner Shadow & Orange-Gold Curl */}
          <path
            d="M 65 97 C 71 91 74 75 76 70 C 79 65 92 67 97 63 C 96 78 81 95 65 97 Z"
            fill="#FFA000"
          />
          <path
            d="M 65 97 C 70 90 73 77 76 72 C 79 68 90 68 97 63 C 88 73 76 87 65 97 Z"
            fill="#FFD426"
          />

          {/* Bold Emerald-Green Discontinuous "i"-shaped Cross (#049A35) */}
          <circle cx="50" cy="24" r="6.2" fill="#049A35" />
          <rect x="44.2" y="34" width="11.6" height="44" rx="5.8" fill="#049A35" />
          <rect x="23" y="45" width="54" height="11.6" rx="5.8" fill="#049A35" />
        </svg>
      </div>
    </div>
  );
};
