import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RoleGuard } from "@/components/RoleGuard";

interface ActivityRow {
  kpi: string;
  kpiCode: string;
  frequency: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  weightage: number;
  target: number;
  actual: number;
  pipeline: number;
  weightageAchieved: number;
}

export default function EmployeeReportActivity() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [appliedParams, setAppliedParams] = useState<string>(() => {
    const params = new URLSearchParams();
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    d.setDate(1);
    params.set('fromDate', d.toISOString().split('T')[0]);
    params.set('toDate', new Date().toISOString().split('T')[0]);
    return params.toString();
  });

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    setAppliedParams(params.toString());
  };

  const { data: rows, isLoading } = useQuery<ActivityRow[]>({
    queryKey: ['/api/employee-reports/activity', appliedParams],
    queryFn: async () => {
      const res = await fetch(`/api/employee-reports/activity?${appliedParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Approved</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Submitted</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Draft</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalWeightage = rows?.reduce((sum, r) => sum + r.weightage, 0) || 0;
  const totalWeightageAchieved = rows?.reduce((sum, r) => sum + r.weightageAchieved, 0) || 0;

  return (
    <RoleGuard allowedRoles={["employee"]}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Activity Report</h1>
          <p className="text-muted-foreground">View your KPI review activity and performance details</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>From Date</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label>To Date</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" />
              </div>
              <Button onClick={handleApplyFilters}>Apply</Button>
            </div>
          </CardContent>
        </Card>

        {rows && rows.length > 0 && (
          <div className="flex gap-4">
            <Card className="flex-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{rows.length}</p>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Total Weightage</p>
                <p className="text-2xl font-bold">{totalWeightage}</p>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Weightage Achieved</p>
                <p className="text-2xl font-bold">{totalWeightageAchieved}</p>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">Achievement %</p>
                <p className="text-2xl font-bold">
                  {totalWeightage > 0 ? Math.round((totalWeightageAchieved / totalWeightage) * 100) : 0}%
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>KPI Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !rows || rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No KPI reviews found for the selected period.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KPI</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Weightage</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Pipeline</TableHead>
                      <TableHead className="text-right">Wtg. Achieved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.kpi}</TableCell>
                        <TableCell>{row.frequency}</TableCell>
                        <TableCell className="text-sm">{row.period}</TableCell>
                        <TableCell>{getStatusBadge(row.status)}</TableCell>
                        <TableCell className="text-right">{row.weightage}</TableCell>
                        <TableCell className="text-right">{row.target}</TableCell>
                        <TableCell className="text-right">{row.actual}</TableCell>
                        <TableCell className="text-right">{row.pipeline}</TableCell>
                        <TableCell className="text-right font-medium">{row.weightageAchieved}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
