import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PatientStatsProps {
  stats: Array<{ label: string; value: number | string }>;
}

export function PatientStats({ stats }: PatientStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((item) => (
        <Card key={item.label} className="border border-border bg-card/70 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
