// src/components/PanelHeader.tsx
interface PanelHeaderProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    onRefresh?: () => void;
}

export function PanelHeader({ title, subtitle, action, onRefresh }: PanelHeaderProps) {
    return (
        <div className="panel-header">
            <div>
                <h1 className="panel-title">{title}</h1>
                {subtitle && <p className="panel-subtitle">{subtitle}</p>}
            </div>
            {(action || onRefresh) && (
                <div className="panel-header-action">
                    {onRefresh && <button type="button" className="btn-refresh" onClick={onRefresh}>Refresh</button>}
                    {action}
                </div>
            )}
        </div>
    );
}
