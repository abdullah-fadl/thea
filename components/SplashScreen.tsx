'use client';

import { useState, useEffect } from 'react';
import { appConfig } from '@/lib/config';
import { useLang } from '@/hooks/use-lang';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Splash Screen Component
 * 
 * Displays an animated splash screen with logo, title, and slogan.
 * Shows only once per browser session (using sessionStorage).
 * 
 * Animation sequence:
 * 1. Logo appears with subtle pulse
 * 2. Title "Thea" fades in
 * 3. Slogan "UNIFIED INTELLIGENCE PLATFORM" fades in
 * 4. After ~2 seconds, content animates upward and fades out
 * 5. onComplete callback is triggered to reveal login page
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [showLogo, setShowLogo] = useState(false);
  const [showSlogan, setShowSlogan] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Step 1: Show logo immediately
    setShowLogo(true);

    // Step 2: Show slogan after 800ms
    const sloganTimer = setTimeout(() => {
      setShowSlogan(true);
    }, 800);

    // Step 4: Start exit animation after 2.5 seconds total (2 seconds after slogan appears)
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      // Trigger onComplete after animation completes
      setTimeout(() => {
        onComplete();
      }, 800); // Match transition duration
    }, 2500);

    return () => {
      clearTimeout(sloganTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-cyan-600 via-cyan-700 to-cyan-800 z-50 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${
        isExiting ? 'opacity-0 translate-y-[-50px]' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="text-center space-y-8">
        <div
          className={`flex justify-center transition-all duration-500 ${
            showLogo ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } ${isExiting ? 'scale-90' : ''}`}
        >
          <img
            src="/brand/thea-icon.svg"
            alt={`${appConfig.name} Logo`}
            className="w-24 h-24 animate-pulse"
          />
        </div>

        <div
          className={`space-y-4 transition-all duration-500 ${
            showSlogan ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          } ${isExiting ? 'opacity-0 translate-y-[-20px]' : ''}`}
        >
          <div className="w-64 h-2 bg-white/20 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-white rounded-full animate-loading-bar" />
          </div>
          <p className="text-white/80 text-sm">{tr('جاري التحميل...', 'Loading...')}</p>
        </div>
      </div>
    </div>
  );
}

