'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useTheme } from '@/components/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import DemoSidebar from './DemoSidebar';
import DemoTourOverlay from './DemoTourOverlay';
import DemoDashboard from './screens/DemoDashboard';
import DemoOPDQueue from './screens/DemoOPDQueue';
import DemoPatientRecord from './screens/DemoPatientRecord';
import DemoOrders from './screens/DemoOrders';
import DemoLabResults from './screens/DemoLabResults';
import DemoBilling from './screens/DemoBilling';
import DemoER from './screens/DemoER';
import DemoIPD from './screens/DemoIPD';
import DemoPharmacy from './screens/DemoPharmacy';
import DemoRadiology from './screens/DemoRadiology';
import DemoScheduling from './screens/DemoScheduling';
import DemoNursing from './screens/DemoNursing';
import DemoOR from './screens/DemoOR';
import DemoDental from './screens/DemoDental';
import DemoObgyn from './screens/DemoObgyn';
import DemoQuality from './screens/DemoQuality';
import DemoRegistration from './screens/DemoRegistration';
import DemoSAM from './screens/DemoSAM';
import { Globe, Sun, Moon, Menu, X } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;

const screens: Record<string, React.ComponentType> = {
  dashboard: DemoDashboard,
  opd: DemoOPDQueue,
  patient: DemoPatientRecord,
  orders: DemoOrders,
  lab: DemoLabResults,
  billing: DemoBilling,
  er: DemoER,
  ipd: DemoIPD,
  pharmacy: DemoPharmacy,
  radiology: DemoRadiology,
  scheduling: DemoScheduling,
  nursing: DemoNursing,
  or: DemoOR,
  dental: DemoDental,
  obgyn: DemoObgyn,
  quality: DemoQuality,
  registration: DemoRegistration,
  sam: DemoSAM,
};

export default function DemoExperience() {
  const [activeStep, setActiveStep] = useState('dashboard');
  const [showTour, setShowTour] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language, setLanguage, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { theme, toggleTheme } = useTheme();

  const Screen = screens[activeStep] || DemoDashboard;

  const handleStepChange = (step: string) => {
    setActiveStep(step);
    setShowTour(true);
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — hidden on mobile, shown on md+ */}
      <div className={`
        fixed inset-y-0 start-0 z-50 transition-transform duration-300 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
      `}>
        <DemoSidebar activeStep={activeStep} onStepChange={handleStepChange} />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 px-4 sm:px-5 flex items-center justify-between border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center md:hidden"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="text-sm font-medium text-muted-foreground">
              {tr('وضع التجربة', 'Demo Mode')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Screen content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Tour overlay */}
      <DemoTourOverlay
        activeStep={activeStep}
        visible={showTour}
        onDismiss={() => setShowTour(false)}
      />
    </div>
  );
}
