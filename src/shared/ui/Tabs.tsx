import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './Tabs.css';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeId: string | null;
  onChange: (id: string) => void;
  ariaLabel?: string;
  variant?: 'default' | 'settings' | 'segmented';
}

export function Tabs({ items, activeId, onChange, ariaLabel, variant = 'default' }: TabsProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabIndicator, setTabIndicator] = useState<{
    x: number;
    width: number;
    ready: boolean;
  }>({
    x: 0,
    width: 0,
    ready: false,
  });

  const syncTabIndicator = useCallback(() => {
    const tabs = tabsRef.current;
    const targetTab = hoveredTab ?? activeId;
    const button = tabs?.querySelector<HTMLElement>(`[data-ui-tab="${targetTab}"]`);

    if (!tabs || !button || !targetTab) {
      setTabIndicator((state) => (state.ready ? { ...state, ready: false } : state));
      return;
    }

    const tabsRect = tabs.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    setTabIndicator({
      x: buttonRect.left - tabsRect.left,
      width: buttonRect.width,
      ready: true,
    });
  }, [activeId, hoveredTab]);

  useLayoutEffect(() => {
    syncTabIndicator();
  }, [activeId, hoveredTab, items, syncTabIndicator]);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) {
      return;
    }

    const resizeObserver = new ResizeObserver(syncTabIndicator);
    resizeObserver.observe(tabs);
    window.addEventListener('resize', syncTabIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncTabIndicator);
    };
  }, [syncTabIndicator]);

  const tabIndicatorStyle = tabIndicator.ready
    ? ({
        transform: `translateX(${tabIndicator.x}px)`,
        width: `${tabIndicator.width}px`,
      } as CSSProperties)
    : undefined;

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={tabsRef}
      className={`ui-tabs ui-tabs--${variant}`}
      role="tablist"
      aria-label={ariaLabel}
      onMouseLeave={() => setHoveredTab(null)}
    >
      {variant !== 'segmented' && tabIndicator.ready ? (
        <span className="ui-tabs__indicator" aria-hidden="true" style={tabIndicatorStyle} />
      ) : null}

      {items.map((item) => {
        const isActive = item.id === activeId;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-ui-tab={item.id}
            aria-selected={isActive}
            className={`ui-tabs__tab${isActive ? ' ui-tabs__tab--active' : ''}`}
            onClick={() => onChange(item.id)}
            onMouseEnter={() => setHoveredTab(item.id)}
            onFocus={() => setHoveredTab(item.id)}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                setHoveredTab(null);
              }
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
