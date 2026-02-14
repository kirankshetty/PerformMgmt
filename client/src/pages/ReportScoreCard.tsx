import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGuard } from "@/components/RoleGuard";

export default function ReportScoreCard() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
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

  const [appliedParams, setAppliedParams] = useState<string>(() => {
    const params = new URLSearchParams();
    const d = new Date();
    d.setDate(1);
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
  };

  const handleClearFilters = () => {
    const d = new Date();
    d.setDate(1);
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
    const params = new URLSearchParams();
    params.set('fromDate', defaultFrom);
    params.set('toDate', defaultTo);
    params.set('scope', 'direct');
    setAppliedParams(params.toString());
  };

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['/api/reports/score-card', appliedParams],
    queryFn: () => fetch(`/api/reports/score-card?${appliedParams}`).then(r => r.json()),
    enabled: !!fromDate && !!toDate,
  });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return '-';
    }
  };

  return (
    <RoleGuard allowedRoles={["manager"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Score Card Report</h1>
          <p className="text-muted-foreground">View evaluation scores for your team members</p>
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
                <p className="text-muted-foreground">No data found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Code</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Review Cycle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Overall Rating</TableHead>
                      <TableHead>Calibrated Rating</TableHead>
                      <TableHead>Self Evaluation Date</TableHead>
                      <TableHead>Manager Evaluation Date</TableHead>
                      <TableHead>Meeting Completed</TableHead>
                      <TableHead>Finalized Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row: any, index: number) => (
                      <TableRow key={row.id || index}>
                        <TableCell className="font-medium">{row.employeeCode || '-'}</TableCell>
                        <TableCell>{row.employeeName || '-'}</TableCell>
                        <TableCell>{row.department || '-'}</TableCell>
                        <TableCell>{row.location || '-'}</TableCell>
                        <TableCell>{row.reviewCycleName || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === 'completed' ? 'default' : 'secondary'}>
                            {row.status || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.overallRating ?? '-'}</TableCell>
                        <TableCell>{row.calibratedRating ?? '-'}</TableCell>
                        <TableCell>{formatDate(row.selfEvaluationSubmittedAt)}</TableCell>
                        <TableCell>{formatDate(row.managerEvaluationSubmittedAt)}</TableCell>
                        <TableCell>{formatDate(row.meetingCompletedAt)}</TableCell>
                        <TableCell>{formatDate(row.finalizedAt)}</TableCell>
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
