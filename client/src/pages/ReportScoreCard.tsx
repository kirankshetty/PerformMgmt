import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGuard } from "@/components/RoleGuard";

interface PeriodData {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  target: number;
  actual: number;
  status: string;
}

interface EmployeeData {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  target: number;
  actual: number;
  weightage: number;
  weightageAchieved: number;
  wtdScore: number;
  periods: PeriodData[];
}

interface KpiRow {
  kpiId: string;
  kpi: string;
  kpiCode: string;
  kraName: string;
  kraCode: string;
  frequency: string;
  weightage: number;
  target: number;
  actual: number;
  weightageAchieved: number;
  wtdScore: number;
  employees: EmployeeData[];
}

export default function ReportScoreCard() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scope, setScope] = useState<'direct' | 'all'>('direct');
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [businessRoleFilter, setBusinessRoleFilter] = useState<string[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([]);
  const [expandedKpis, setExpandedKpis] = useState<Set<string>>(new Set());
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  const [appliedParams, setAppliedParams] = useState<string>(() => {
    const params = new URLSearchParams();
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    params.set('fromDate', d.toISOString().split('T')[0]);
    params.set('toDate', new Date().toISOString().split('T')[0]);
    params.set('scope', 'direct');
    return params.toString();
  });

  const { data: filterOptions } = useQuery<{
    locations: Array<{ id: string; name: string }>;
    departments: Array<{ id: string; name: string }>;
    levels: Array<{ id: string; description: string }>;
    grades: Array<{ id: string; description: string }>;
    businessRoles: Array<{ id: string; name: string }>;
    employees: Array<{ id: string; firstName: string; lastName: string; employeeCode: string }>;
  }>({
    queryKey: ['/api/reports/filter-options'],
  });

  const locations = filterOptions?.locations || [];
  const departments = filterOptions?.departments || [];
  const levels = filterOptions?.levels || [];
  const grades = filterOptions?.grades || [];
  const businessRoles = filterOptions?.businessRoles || [];
  const teamMembers = (filterOptions?.employees || []).map(e => ({ ...e, code: e.employeeCode }));

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    params.set('scope', scope);
    if (locationFilter.length) params.set('location', locationFilter.join(','));
    if (departmentFilter.length) params.set('department', departmentFilter.join(','));
    if (levelFilter.length) params.set('level', levelFilter.join(','));
    if (gradeFilter.length) params.set('grade', gradeFilter.join(','));
    if (businessRoleFilter.length) params.set('businessRole', businessRoleFilter.join(','));
    if (employeeFilter.length) params.set('employee', employeeFilter.join(','));
    return params.toString();
  };

  const handleApplyFilters = () => {
    setAppliedParams(buildQueryParams());
    setExpandedKpis(new Set());
    setExpandedEmployees(new Set());
  };

  const handleClearFilters = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const defaultFrom = d.toISOString().split('T')[0];
    const defaultTo = new Date().toISOString().split('T')[0];
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setScope('direct');
    setLocationFilter([]);
    setDepartmentFilter([]);
    setLevelFilter([]);
    setGradeFilter([]);
    setBusinessRoleFilter([]);
    setEmployeeFilter([]);
    setExpandedKpis(new Set());
    setExpandedEmployees(new Set());
    const params = new URLSearchParams();
    params.set('fromDate', defaultFrom);
    params.set('toDate', defaultTo);
    params.set('scope', 'direct');
    setAppliedParams(params.toString());
  };

  const { data, isLoading } = useQuery<KpiRow[]>({
    queryKey: ['/api/reports/score-card', appliedParams],
    queryFn: () => fetch(`/api/reports/score-card?${appliedParams}`).then(r => r.json()),
    enabled: !!fromDate && !!toDate,
  });

  const toggleKpi = (kpiId: string) => {
    setExpandedKpis(prev => {
      const next = new Set(prev);
      if (next.has(kpiId)) {
        next.delete(kpiId);
        const newEmpSet = new Set(expandedEmployees);
        for (const key of expandedEmployees) {
          if (key.startsWith(kpiId + ':')) newEmpSet.delete(key);
        }
        setExpandedEmployees(newEmpSet);
      } else {
        next.add(kpiId);
      }
      return next;
    });
  };

  const toggleEmployee = (kpiId: string, employeeId: string) => {
    const key = `${kpiId}:${employeeId}`;
    setExpandedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatPeriodDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return '-';
    }
  };

  const totalWeightage = data?.reduce((sum, row) => sum + row.weightage, 0) || 0;
  const totalWtdScore = data?.reduce((sum, row) => sum + row.wtdScore, 0) || 0;

  return (
    <RoleGuard allowedRoles={["manager"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Score Card Report</h1>
          <p className="text-muted-foreground">Aggregated KPI performance across your team members</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>From Date</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To Date</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Scope</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as 'direct' | 'all')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct Reports</SelectItem>
                    <SelectItem value="all">All Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Select value={locationFilter[0] || 'all'} onValueChange={(v) => setLocationFilter(v === 'all' ? [] : [v])}>
                  <SelectTrigger><SelectValue placeholder="All Locations" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Select value={departmentFilter[0] || 'all'} onValueChange={(v) => setDepartmentFilter(v === 'all' ? [] : [v])}>
                  <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Level</Label>
                <Select value={levelFilter[0] || 'all'} onValueChange={(v) => setLevelFilter(v === 'all' ? [] : [v])}>
                  <SelectTrigger><SelectValue placeholder="All Levels" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {levels.map(level => (
                      <SelectItem key={level.id} value={level.id}>{level.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Grade</Label>
                <Select value={gradeFilter[0] || 'all'} onValueChange={(v) => setGradeFilter(v === 'all' ? [] : [v])}>
                  <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {grades.map(grade => (
                      <SelectItem key={grade.id} value={grade.id}>{grade.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Business Role</Label>
                <Select value={businessRoleFilter[0] || 'all'} onValueChange={(v) => setBusinessRoleFilter(v === 'all' ? [] : [v])}>
                  <SelectTrigger><SelectValue placeholder="All Business Roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Business Roles</SelectItem>
                    {businessRoles.map(br => (
                      <SelectItem key={br.id} value={br.id}>{br.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Employee</Label>
                <Select value={employeeFilter[0] || 'all'} onValueChange={(v) => setEmployeeFilter(v === 'all' ? [] : [v])}>
                  <SelectTrigger><SelectValue placeholder="All Employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {teamMembers.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={handleApplyFilters}>Apply Filters</Button>
              <Button variant="outline" onClick={handleClearFilters}>Clear Filters</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score Card</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No KPI data found for the selected filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">KPI</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Weightage</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Weightage Achieved</TableHead>
                      <TableHead className="text-right">WTD Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <>
                        <TableRow
                          key={row.kpiId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleKpi(row.kpiId)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {row.employees.length > 0 ? (
                                expandedKpis.has(row.kpiId) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )
                              ) : <div className="w-4" />}
                              <span>{row.kpi}</span>
                            </div>
                          </TableCell>
                          <TableCell>{row.frequency}</TableCell>
                          <TableCell className="text-right">{row.weightage}</TableCell>
                          <TableCell className="text-right">{row.target}</TableCell>
                          <TableCell className="text-right">{row.actual}</TableCell>
                          <TableCell className="text-right">{row.weightageAchieved}</TableCell>
                          <TableCell className="text-right font-semibold">{row.wtdScore}</TableCell>
                        </TableRow>

                        {expandedKpis.has(row.kpiId) && row.employees.map((emp) => (
                          <>
                            <TableRow
                              key={`${row.kpiId}-${emp.employeeId}`}
                              className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleEmployee(row.kpiId, emp.employeeId)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2 pl-6">
                                  {emp.periods.length > 0 ? (
                                    expandedEmployees.has(`${row.kpiId}:${emp.employeeId}`) ? (
                                      <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    )
                                  ) : <div className="w-3" />}
                                  <span className="text-sm">{emp.employeeName}</span>
                                  <span className="text-xs text-muted-foreground">({emp.employeeCode})</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">-</TableCell>
                              <TableCell className="text-right text-sm">{emp.weightage}</TableCell>
                              <TableCell className="text-right text-sm">{emp.target}</TableCell>
                              <TableCell className="text-right text-sm">{emp.actual}</TableCell>
                              <TableCell className="text-right text-sm">{emp.weightageAchieved}</TableCell>
                              <TableCell className="text-right text-sm">{emp.wtdScore}</TableCell>
                            </TableRow>

                            {expandedEmployees.has(`${row.kpiId}:${emp.employeeId}`) && emp.periods.map((period) => (
                              <TableRow
                                key={`${row.kpiId}-${emp.employeeId}-${period.periodKey}`}
                                className="bg-muted/10"
                              >
                                <TableCell>
                                  <div className="pl-14 text-xs text-muted-foreground">
                                    {period.periodKey}
                                    <span className="ml-2">
                                      ({formatPeriodDate(period.periodStart)} - {formatPeriodDate(period.periodEnd)})
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={period.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                    {period.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs">-</TableCell>
                                <TableCell className="text-right text-xs">{period.target}</TableCell>
                                <TableCell className="text-right text-xs">{period.actual}</TableCell>
                                <TableCell className="text-right text-xs">
                                  {period.target > 0 ? Math.round((period.actual / period.target) * 100) : 0}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {period.target > 0 ? ((period.actual / period.target) * row.weightage).toFixed(1) : '0'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        ))}
                      </>
                    ))}

                    <TableRow className="border-t-2 font-bold bg-muted/20">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{totalWeightage}</TableCell>
                      <TableCell className="text-right">{data.reduce((s, r) => s + r.target, 0)}</TableCell>
                      <TableCell className="text-right">{data.reduce((s, r) => s + r.actual, 0)}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">{totalWtdScore.toFixed(1)}</TableCell>
                    </TableRow>
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
