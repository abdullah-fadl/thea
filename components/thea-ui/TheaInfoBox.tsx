interface TheaInfoBoxProps {
  label: string;
  value: React.ReactNode;
}

export function TheaInfoBox({ label, value }: TheaInfoBoxProps) {
  return (
    <div className="bg-muted/50 border border-border rounded-xl p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-extrabold mt-0.5 text-foreground">{value}</div>
    </div>
  );
}
