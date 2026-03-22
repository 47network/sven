/** Stat card for dashboard. */
export function StatCard({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
}) {
  const positive = change && !change.startsWith('-');
  return (
    <div className="card flex items-start gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950">
        <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        {change && (
          <p className={`mt-0.5 text-xs ${positive ? 'text-green-600' : 'text-red-500'}`}>
            {change}
          </p>
        )}
      </div>
    </div>
  );
}
