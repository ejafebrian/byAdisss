import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  fallbackLabel?: string;
}

export function SafeImage({
  src,
  alt,
  fallbackLabel,
  className = '',
  ...rest
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FDE8EE] via-[#FFF6F8] to-[#F0C6D2]/55 text-[#7D4E5D] ${className}`}
      >
        <ShoppingBag className="w-6 h-6 opacity-60 mb-1" aria-hidden="true" />
        {fallbackLabel && (
          <span className="text-[11px] font-medium px-2 text-center line-clamp-1 opacity-75">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}
