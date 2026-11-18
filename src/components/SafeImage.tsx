import React, { useEffect, useRef, useState } from 'react';
import { ShoppingBag } from 'lucide-react';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  fallbackLabel?: string;
  priority?: boolean;
}

export function SafeImage({
  src,
  alt,
  fallbackLabel,
  className = '',
  priority = false,
  ...rest
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailed(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

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

  const isRoundedFull = className.includes('rounded-full');

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#FFF6F8] ${isRoundedFull ? 'rounded-full' : ''}`}>
      {!loaded && <div className="absolute inset-0 rose-shimmer" aria-hidden="true" />}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        {...rest}
      />
    </div>
  );
}
