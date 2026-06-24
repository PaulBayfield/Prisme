import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface KpiCardDetail {
  label: string;
  value: string;
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  details?: KpiCardDetail[];
}

export function KpiCard({ label, value, icon: Icon, hint, details }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {details && details.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={<div className="blur-sensitive w-fit cursor-default text-2xl font-semibold tabular-nums" />}
            >
              {value}
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-1">
                {details.map((detail, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <span className="text-background/70">{detail.label}</span>
                    <span className="font-medium tabular-nums">{detail.value}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="blur-sensitive text-2xl font-semibold tabular-nums">{value}</div>
        )}
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
