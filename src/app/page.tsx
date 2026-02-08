'use client';

import { useState, useEffect, Suspense, lazy } from 'react';
import styles from './page.module.css';
import { MARKETS, getNextMarketEvent, formatCountdown, isMarketOpen } from '@/lib/marketData';

// Lazy load globe
const ParticleEarthGlobe = lazy(() => import('@/components/ParticleEarthGlobe'));

export default function Home() {
  const [countdown, setCountdown] = useState<{ hours: string; minutes: string; seconds: string; days?: string }>({ hours: '--', minutes: '--', seconds: '--' });
  const [eventInfo, setEventInfo] = useState<{ market: string; type: 'open' | 'close' } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const update = () => {
      const event = getNextMarketEvent();
      if (event) {
        setCountdown(formatCountdown(event.timeUntil));
        setEventInfo({ market: event.market.name, type: event.type });
      }

      const open = MARKETS.filter(m => isMarketOpen(m)).length;
      setOpenCount(open);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isClient]);

  return (
    <main className={styles.main}>
      {/* Globe background */}
      <div className={styles.globeContainer}>
        {isClient && (
          <Suspense fallback={<div className={styles.loader}><div className={styles.spinner} /></div>}>
            <ParticleEarthGlobe markets={MARKETS} />
          </Suspense>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Status */}
        <div className={styles.header}>
          <div className={styles.status}>
            <span className={styles.statusDot} data-open={openCount > 0} />
            <span>{openCount} market{openCount !== 1 ? 's' : ''} open</span>
          </div>
        </div>

        {/* Main countdown */}
        <div className={styles.countdownSection}>
          {eventInfo && (
            <div className={styles.eventLabel}>
              {eventInfo.market} {eventInfo.type === 'open' ? 'opens' : 'closes'} in
            </div>
          )}

          <div className={styles.countdown}>
            {countdown.days && (
              <>
                <div className={styles.unit}>
                  <span className={styles.value}>{countdown.days}</span>
                  <span className={styles.label}>days</span>
                </div>
                <span className={styles.separator}>:</span>
              </>
            )}
            <div className={styles.unit}>
              <span className={styles.value}>{countdown.hours}</span>
              <span className={styles.label}>hours</span>
            </div>
            <span className={styles.separator}>:</span>
            <div className={styles.unit}>
              <span className={styles.value}>{countdown.minutes}</span>
              <span className={styles.label}>min</span>
            </div>
            <span className={styles.separator}>:</span>
            <div className={styles.unit}>
              <span className={styles.value}>{countdown.seconds}</span>
              <span className={styles.label}>sec</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} data-status="open" />
            <span>Open</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} data-status="closed" />
            <span>Closed</span>
          </div>
        </div>
      </div>
    </main>
  );
}
