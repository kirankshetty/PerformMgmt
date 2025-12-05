import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  User,
  ClipboardCheck,
  Calendar,
  Star,
  TrendingUp,
  Clock,
  Target,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";

interface EmployeeMetrics {
  totalEvaluations: number;
  completedEvaluations: number;
  pendingEvaluations: number;
  overdueEvaluations: number;
  averageRating: number;
  lastEvaluationDate: string;
  nextDeadline: string;
  improvementGoals: number;
}

interface Evaluation {
  id: string;
  period: string;
  type: 'self' | 'manager' | 'peer';
  status: 'completed' | 'pending' | 'overdue' | 'not_started';
  dueDate: string;
  submittedDate?: string;
  rating?: number;
  managerName?: string;
  managerFeedback?: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  type: 'evaluation' | 'meeting' | 'goal' | 'feedback';
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  status: 'pending' | 'in_progress';
}

interface GoalProgress {
  id: string;
  title: string;
  description: string;
  progress: number;
  targetDate: string;
  status: 'on_track' | 'at_risk' | 'behind';
  category: 'technical' | 'leadership' | 'communication' | 'productivity';
}

export default function EmployeeDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<EmployeeMetrics>({
    queryKey: ["/api/dashboard/employee/metrics"],
  });

  const { data: evaluations = [], isLoading: evaluationsLoading } = useQuery<Evaluation[]>({
    queryKey: ["/api/dashboard/employee/evaluations"],
  });

  const { data: upcomingTasks = [], isLoading: tasksLoading } = useQuery<UpcomingTask[]>({
    queryKey: ["/api/dashboard/employee/tasks"],
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<GoalProgress[]>({
    queryKey: ["/api/dashboard/employee/goals"],
  });

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="employee-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Performance Dashboard</h1>
          <p className="text-muted-foreground">Track your evaluations, goals, and professional development</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/evaluations">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              My Evaluations
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/meetings">
              <Calendar className="h-4 w-4 mr-2" />
              My Meetings
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Employee Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="evaluations-overview-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Evaluations</p>
                <p className="text-2xl font-bold">{metrics?.completedEvaluations || 0}/{metrics?.totalEvaluations || 0}</p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-4">
              <Progress 
                value={metrics?.totalEvaluations ? (metrics.completedEvaluations / metrics.totalEvaluations) * 100 : 0} 
                className="h-2" 
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="pending-tasks-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{metrics?.pendingEvaluations || 0}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4">
              {metrics?.overdueEvaluations ? (
                <span className="text-xs text-red-600">{metrics.overdueEvaluations} overdue</span>
              ) : (
                <span className="text-xs text-green-600">All up to date</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="performance-rating-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Latest Rating</p>
                <p className="text-2xl font-bold">{metrics?.averageRating?.toFixed(1) || 'N/A'}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Star className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1">
              {metrics?.averageRating ? (
                [1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={`h-3 w-3 ${star <= metrics.averageRating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                  />
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No rating yet</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Link href="/development-goals">
          <Card data-testid="development-goals-card" className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Goals</p>
                  <p className="text-2xl font-bold">{metrics?.improvementGoals || 0}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs text-blue-600">Click to view or add goals</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Evaluations and Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Evaluations</CardTitle>
              <CardDescription>Your evaluation history and feedback</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/evaluations">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluationsLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg"></div>
                ))}
              </div>
            ) : evaluations.length > 0 ? (
              evaluations.slice(0, 5).map((evaluation) => (
                <div key={evaluation.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      evaluation.status === 'completed' ? 'bg-green-100' :
                      evaluation.status === 'overdue' ? 'bg-red-100' : 'bg-yellow-100'
                    }`}>
                      {evaluation.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : evaluation.status === 'overdue' ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{evaluation.period}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {evaluation.type} evaluation • {evaluation.managerName && `Manager: ${evaluation.managerName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      evaluation.status === 'completed' ? 'secondary' :
                      evaluation.status === 'overdue' ? 'destructive' : 'default'
                    }>
                      {evaluation.status === 'completed' ? 'Completed' :
                       evaluation.status === 'overdue' ? 'Overdue' : 'Pending'}
                    </Badge>
                    {evaluation.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        <span className="text-xs">{evaluation.rating}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No evaluations yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Tasks</CardTitle>
              <CardDescription>Actions requiring your attention</CardDescription>
            </div>
            <Badge variant="outline">{upcomingTasks.filter(t => t.priority === 'high').length} high priority</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasksLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded-lg"></div>
                ))}
              </div>
            ) : upcomingTasks.length > 0 ? (
              upcomingTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      task.priority === 'high' ? 'bg-red-500' :
                      task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {task.dueDate} • {task.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={task.status === 'in_progress' ? 'default' : 'outline'} className="text-xs">
                      {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No upcoming tasks</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Development Goals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Development Goals</CardTitle>
            <CardDescription>Track progress on your professional development objectives</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/development-goals">Add Goal</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <div className="animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => (
                <div key={goal.id} className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{goal.title}</p>
                    <Badge variant={
                      goal.status === 'on_track' ? 'default' :
                      goal.status === 'at_risk' ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {goal.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{goal.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Target: {goal.targetDate}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No development goals set</p>
              <p className="text-sm text-muted-foreground">Set goals to track your professional growth</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button asChild data-testid="complete-evaluation-button">
              <Link href="/evaluations">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Complete Evaluation
              </Link>
            </Button>
            <Button variant="outline" asChild data-testid="view-meetings-button">
              <Link href="/meetings">
                <Calendar className="h-4 w-4 mr-2" />
                View Meetings
              </Link>
            </Button>
            <Button variant="outline">
              <MessageSquare className="h-4 w-4 mr-2" />
              Request Feedback
            </Button>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Performance Report
            </Button>
            <Button variant="outline">
              <Target className="h-4 w-4 mr-2" />
              Set New Goal
            </Button>
            <Button variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              View Progress
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}