import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Building,
  ChartPie,
  Users,
  ClipboardList,
  ChartBar,
  FileText,
  Calendar,
  Settings,
  Menu,
  MapPin,
  Layers,
  Award,
  Clock,
  Repeat,
  CalendarDays,
  Building2,
  Play,
  Search,
  CalendarCheck,
  Target,
} from "lucide-react";
import type { Company } from "@shared/schema";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: ChartPie },
  { href: "/companies", label: "Company Management", icon: Building, roles: ["super_admin"] },
  { href: "/locations", label: "Location Management", icon: MapPin, roles: ["admin"] },
  { href: "/departments", label: "Department Management", icon: Building2, roles: ["admin"] },
  { href: "/levels", label: "Level Management", icon: Layers, roles: ["admin"] },
  { href: "/grades", label: "Grade Management", icon: Award, roles: ["admin"] },
  { href: "/users", label: "User Management", icon: Users, roles: ["super_admin", "admin"] },
  { href: "/appraisal-cycles", label: "Appraisal Cycles", icon: Clock, roles: ["admin"] },
  { href: "/review-frequencies", label: "Review Frequencies", icon: Repeat, roles: ["admin"] },
  { href: "/frequency-calendars", label: "Frequency Calendars", icon: Calendar, roles: ["admin"] },
  { href: "/frequency-calendar-details", label: "Calendar Details", icon: CalendarDays, roles: ["admin"] },
  { href: "/appraisal-groups", label: "Appraisal Groups", icon: Users, roles: ["hr_manager"] },
  { href: "/initiate-appraisal", label: "Initiate Appraisal Cycle", icon: Play, roles: ["hr_manager"] },
  { href: "/review-appraisal", label: "Review Progress", icon: Search, roles: ["hr_manager"] },
  { href: "/hr-meetings", label: "View Meetings", icon: CalendarCheck, roles: ["hr_manager"] },
  { href: "/calibrate-ratings", label: "Calibrate Ratings", icon: Award, roles: ["hr_manager"] },
  { href: "/questionnaires", label: "Questionnaires", icon: FileText, roles: ["super_admin", "admin", "hr_manager"] },
  { href: "/evaluations", label: "My Evaluations", icon: ClipboardList, roles: ["employee"] },
  { href: "/manager-submissions", label: "Submissions", icon: ClipboardList, roles: ["manager"] },
  { href: "/meetings", label: "Meetings", icon: Calendar, roles: ["employee", "manager"] },
  { href: "/development-goals", label: "My Development Goals", icon: Target, roles: ["employee"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();

  // Use active role from session for role switching support
  const activeRole = (user as any)?.activeRole || (user as any)?.role || "employee";

  // Fetch company information to display logo
  const { data: company } = useQuery<Company>({
    queryKey: ["/api/companies/current"],
    enabled: !!user,
  });

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(activeRole);
  });

  return (
    <div
      className={cn(
        "bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      data-testid="sidebar"
    >
      {/* Company Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex-1 flex items-center justify-center">
              {company?.logoUrl ? (
                <img 
                  src={company.logoUrl} 
                  alt={`${company.name} logo`}
                  className="max-w-[60%] max-h-16 object-contain"
                  data-testid="company-logo"
                />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Building className="h-6 w-6 text-primary-foreground" />
                </div>
              )}
            </div>
          )}
          {collapsed && (
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <Building className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={() => setCollapsed(!collapsed)}
              data-testid="toggle-sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              data-testid={`nav-${item.href.replace('/', '') || 'dashboard'}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>


      {/* Collapse toggle for collapsed state */}
      {collapsed && (
        <div className="p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 p-0"
            onClick={() => setCollapsed(false)}
            data-testid="expand-sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
