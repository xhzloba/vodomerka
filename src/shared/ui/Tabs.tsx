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
}

export function Tabs({ items, activeId, onChange, ariaLabel }: TabsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="ui-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.id === activeId;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ui-tabs__tab${isActive ? ' ui-tabs__tab--active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
