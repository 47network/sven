// src/components/PanelHeader.tsx
interface PanelHeaderProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}

export function PanelHeader({ title, subtitle, action }: PanelHeaderProps) {
    return (
        <div className="panel-header">
            <div>
                <h1 className="panel-title">{title}</h1>
                {subtitle && <p className="panel-subtitle">{subtitle}</p>}
            </div>
            {action && <div className="panel-header-action">{action}</div>}
        </div>
    );
}
