import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Play, Users, FileText, Calendar, Settings2, Upload, X, Plus, ChevronDown, Calendar as CalendarIcon, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SafeUser, AppraisalGroup, QuestionnaireTemplate, FrequencyCalendar, FrequencyCalendarDetails, AppraisalCycle, FunctionalArea, Kra, Kpi, ReviewFrequency } from "@shared/schema";

interface AppraisalGroupWithMembers extends AppraisalGroup {
  members: SafeUser[];
}

type KraWithKpis = Kra & { kpis: Kpi[] };

const MultiSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder,
  testId 
}: { 
  options: { value: string; label: string }[], 
  value: string[], 
  onChange: (value: string[]) => void,
  placeholder: string,
  testId: string
}) => {
  const [open, setOpen] = useState(false);
  
  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };
  
  const displayValue = value.length > 0 
    ? value.length === 1 
      ? options.find(o => o.value === value[0])?.label || value[0]
      : `${value.length} templates selected`
    : placeholder;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal"
          data-testid={testId}
        >
          {displayValue}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-60 overflow-auto p-1">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 rounded-md px-2 py-1 hover:bg-accent"
            >
              <Checkbox
                id={option.value}
                checked={value.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <label
                htmlFor={option.value}
                className="flex-1 cursor-pointer text-sm"
              >
                {option.label}
              </label>
            </div>
          ))}
          {options.length === 0 && (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No questionnaire templates available
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const calendarDetailTimingSchema = z.object({
  detailId: z.string(),
  daysToInitiate: z.coerce.number().min(0).max(365).default(0),
  daysToClose: z.coerce.number().min(1).max(365).default(30),
});

const kpiWeightageSchema = z.object({
  kpiId: z.string(),
  weightage: z.coerce.number().min(0).max(100).default(0),
});

const initiateAppraisalSchema = z.object({
  appraisalType: z.enum(['questionnaire_based', 'kpi_based', 'mbo_based', 'okr_based']),
  questionnaireTemplateIds: z.array(z.string()).default([]),
  documentFile: z.any().optional(),
  appraisalCycleId: z.string().optional(),
  functionalAreaId: z.string().optional(),
  kraId: z.string().optional(),
  kpiWeightages: z.array(kpiWeightageSchema).default([]),
  frequencyCalendarId: z.string().optional(),
  selectedCalendarDetailIds: z.array(z.string()).default([]),
  calendarDetailTimings: z.array(calendarDetailTimingSchema).default([]),
  daysToInitiate: z.coerce.number().min(0).max(365).default(0),
  whenField: z.enum(['after', 'before']).default('after'),
  daysToClose: z.coerce.number().min(1).max(365).default(30),
  excludeTenureLessThanYear: z.boolean().default(false),
  excludeDojFromDate: z.date().optional(),
  excludeDojTillDate: z.date().optional(),
  excludedEmployeeIds: z.array(z.string()).default([]),
  makePublic: z.boolean().default(false),
  publishType: z.enum(['now', 'as_per_calendar']).default('now'),
}).refine((data) => {
  if (data.appraisalType === 'questionnaire_based' || data.appraisalType === 'mbo_based') {
    return data.questionnaireTemplateIds && data.questionnaireTemplateIds.length > 0;
  }
  if (data.appraisalType === 'kpi_based') {
    return !!data.appraisalCycleId && !!data.kraId;
  }
  return true;
}, {
  message: "Please select required fields based on appraisal type",
  path: ["appraisalType"]
});

type CalendarDetailTiming = z.infer<typeof calendarDetailTimingSchema>;
type InitiateAppraisalForm = z.infer<typeof initiateAppraisalSchema>;

export default function InitiateAppraisal() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<AppraisalGroupWithMembers | null>(null);
  const [isInitiateFormOpen, setIsInitiateFormOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [selectedKraId, setSelectedKraId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<InitiateAppraisalForm>({
    resolver: zodResolver(initiateAppraisalSchema),
    defaultValues: {
      appraisalType: 'questionnaire_based',
      questionnaireTemplateIds: [],
      selectedCalendarDetailIds: [],
      calendarDetailTimings: [],
      kpiWeightages: [],
      daysToInitiate: 0,
      whenField: 'after',
      daysToClose: 30,
      excludeTenureLessThanYear: false,
      excludeDojFromDate: undefined,
      excludeDojTillDate: undefined,
      excludedEmployeeIds: [],
      makePublic: false,
      publishType: 'now',
    },
  });

  const { data: groups = [], isLoading } = useQuery<AppraisalGroupWithMembers[]>({
    queryKey: ['/api/appraisal-groups'],
  });

  const { data: questionnaireTemplates = [] } = useQuery<QuestionnaireTemplate[]>({
    queryKey: ['/api/questionnaire-templates'],
  });

  const { data: frequencyCalendars = [] } = useQuery<FrequencyCalendar[]>({
    queryKey: ['/api/frequency-calendars'],
  });

  const { data: calendarDetails = [], isLoading: isLoadingDetails } = useQuery<FrequencyCalendarDetails[]>({
    queryKey: ['/api/frequency-calendars', selectedCalendarId, 'details'],
    queryFn: async () => {
      if (!selectedCalendarId) return [];
      const response = await fetch(`/api/frequency-calendars/${selectedCalendarId}/details`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch calendar details');
      }
      return response.json();
    },
    enabled: !!selectedCalendarId,
  });

  const { data: appraisalCycles = [] } = useQuery<AppraisalCycle[]>({
    queryKey: ['/api/appraisal-cycles'],
  });

  const { data: functionalAreas = [] } = useQuery<FunctionalArea[]>({
    queryKey: ['/api/functional-areas'],
  });

  const { data: kraList = [] } = useQuery<KraWithKpis[]>({
    queryKey: ['/api/kras'],
  });

  const { data: reviewFrequencies = [] } = useQuery<ReviewFrequency[]>({
    queryKey: ['/api/review-frequencies-all'],
  });

  const initiateMutation = useMutation({
    mutationFn: async (data: InitiateAppraisalForm & { appraisalGroupId: string }) => {
      const response = await fetch('/api/initiate-appraisal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${response.status}: ${error}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Appraisal Initiated",
        description: "The appraisal has been successfully initiated.",
      });
      setIsInitiateFormOpen(false);
      setSelectedGroup(null);
      form.reset();
      setUploadedFile(null);
      setSelectedKraId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/initiated-appraisals'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to initiate appraisal. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to initiate appraisal:', error);
    },
  });

  const handleInitiateAppraisal = (group: AppraisalGroupWithMembers) => {
    setSelectedGroup(group);
    setIsInitiateFormOpen(true);
    form.reset({
      appraisalType: 'questionnaire_based',
      questionnaireTemplateIds: [],
      selectedCalendarDetailIds: [],
      calendarDetailTimings: [],
      kpiWeightages: [],
      daysToInitiate: 0,
      whenField: 'after',
      daysToClose: 30,
      excludeTenureLessThanYear: false,
      excludeDojFromDate: undefined,
      excludeDojTillDate: undefined,
      excludedEmployeeIds: [],
      makePublic: false,
      publishType: 'now',
    });
    setUploadedFile(null);
    setSelectedCalendarId(null);
    setSelectedKraId(null);
  };

  const handleCalendarSelection = (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    form.setValue('frequencyCalendarId', calendarId);
    form.setValue('selectedCalendarDetailIds', []);
    form.setValue('calendarDetailTimings', []);
  };

  const initializeCalendarDetailTimings = (selectedDetailIds: string[]) => {
    const currentTimings = form.getValues('calendarDetailTimings');
    const selectedDetails = calendarDetails.filter(detail => selectedDetailIds.includes(detail.id));
    
    const updatedTimings: CalendarDetailTiming[] = selectedDetails.map(detail => {
      const existingTiming = currentTimings.find(t => t.detailId === detail.id);
      if (existingTiming) {
        return existingTiming;
      }
      return {
        detailId: detail.id,
        daysToInitiate: 0,
        daysToClose: 30,
      };
    });
    
    form.setValue('calendarDetailTimings', updatedTimings);
  };

  const handleCalendarDetailSelection = (selectedIds: string[]) => {
    form.setValue('selectedCalendarDetailIds', selectedIds);
    initializeCalendarDetailTimings(selectedIds);
  };

  const handleKraSelection = (kraId: string) => {
    setSelectedKraId(kraId);
    form.setValue('kraId', kraId);
    const selectedKra = kraList.find(k => k.id === kraId);
    if (selectedKra && selectedKra.kpis) {
      const weightages = selectedKra.kpis.map(kpi => ({
        kpiId: kpi.id,
        weightage: kpi.weightageContribution || 0,
      }));
      form.setValue('kpiWeightages', weightages);
    } else {
      form.setValue('kpiWeightages', []);
    }
  };

  const selectedCalendarDetailIds = form.watch('selectedCalendarDetailIds');
  const appraisalType = form.watch('appraisalType');
  const whenField = form.watch('whenField');
  const kpiWeightages = form.watch('kpiWeightages');

  const selectedKra = kraList.find(k => k.id === selectedKraId);
  const totalWeightage = kpiWeightages.reduce((sum, w) => sum + (Number(w.weightage) || 0), 0);
  const isWeightageValid = appraisalType !== 'kpi_based' || !selectedKra || totalWeightage === 100;

  const getReviewFrequencyName = (id: string | null | undefined) => {
    if (!id) return "Not set";
    const freq = reviewFrequencies.find(f => f.id === id);
    return freq ? `${freq.code} - ${freq.description}` : "Unknown";
  };

  const onSubmit = (data: InitiateAppraisalForm) => {
    if (!selectedGroup) return;
    
    if (data.appraisalType === 'kpi_based' && !isWeightageValid) {
      toast({
        title: "Validation Error",
        description: "KPI weightages must total 100%",
        variant: "destructive",
      });
      return;
    }

    const submissionData: any = {
      ...data,
      appraisalGroupId: selectedGroup.id,
    };

    if (data.appraisalType !== 'kpi_based') {
      delete submissionData.appraisalCycleId;
      delete submissionData.functionalAreaId;
      delete submissionData.kraId;
      delete submissionData.kpiWeightages;
      submissionData.documentFile = uploadedFile;
    }
    
    initiateMutation.mutate(submissionData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      form.setValue('documentFile', file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    form.setValue('documentFile', undefined);
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (group.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const whenLabel = whenField === 'before' ? 'Days before calendar period end' : 'Days after calendar period end';

  return (
    <RoleGuard allowedRoles={['hr_manager']}>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Initiate Appraisal Cycle</h1>
            <p className="text-muted-foreground mt-2">
              Select an appraisal group to initiate performance evaluations
            </p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search appraisal groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
              data-testid="search-groups"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-muted-foreground">Loading appraisal groups...</div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No appraisal groups found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery ? "No groups match your search criteria." : "Create some appraisal groups first to initiate appraisals."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-xl font-semibold" data-testid={`group-name-${group.id}`}>
                          {group.name}
                        </h3>
                        <Badge variant="secondary">
                          {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                        </Badge>
                        <Badge 
                          variant={group.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`group-status-${group.id}`}
                        >
                          {group.status}
                        </Badge>
                      </div>
                      
                      {group.description && (
                        <p className="text-muted-foreground mb-3" data-testid={`group-description-${group.id}`}>
                          {group.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {group.members.length} employees
                        </span>
                        <span>
                          Created {group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleInitiateAppraisal(group)}
                        className="flex items-center gap-2"
                        data-testid={`initiate-btn-${group.id}`}
                      >
                        <Play className="h-4 w-4" />
                        Initiate Appraisal
                      </Button>
                    </div>
                  </div>
                  
                  {group.members.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Group Members:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.members.slice(0, 5).map((member) => (
                          <Badge key={member.id} variant="outline" className="text-xs">
                            {member.firstName} {member.lastName}
                          </Badge>
                        ))}
                        {group.members.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{group.members.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isInitiateFormOpen} onOpenChange={setIsInitiateFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Initiate Appraisal Cycle
              </DialogTitle>
              <DialogDescription>
                Configure the appraisal settings for the selected group
              </DialogDescription>
            </DialogHeader>
            
            {selectedGroup && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Selected Appraisal Group</h4>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-medium">{selectedGroup.name}</span>
                      <Badge variant="secondary">
                        {selectedGroup.members.length} members
                      </Badge>
                    </div>
                    {selectedGroup.description && (
                      <p className="text-muted-foreground mt-2">{selectedGroup.description}</p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Appraisal Configuration</h4>
                    
                    <FormField
                      control={form.control}
                      name="appraisalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appraisal Type*</FormLabel>
                          <Select onValueChange={(val) => {
                            field.onChange(val);
                            if (val !== 'kpi_based') {
                              setSelectedKraId(null);
                              form.setValue('appraisalCycleId', undefined);
                              form.setValue('functionalAreaId', undefined);
                              form.setValue('kraId', undefined);
                              form.setValue('kpiWeightages', []);
                            }
                          }} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-appraisal-type">
                                <SelectValue placeholder="Select appraisal type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="questionnaire_based">SMART Objectives</SelectItem>
                              <SelectItem value="kpi_based">KPI Based</SelectItem>
                              <SelectItem value="mbo_based">360 Degree Feedback</SelectItem>
                              <SelectItem value="okr_based">OKR Based</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the type of performance appraisal to conduct
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(appraisalType === 'questionnaire_based' || appraisalType === 'mbo_based') && (
                      <FormField
                        control={form.control}
                        name="questionnaireTemplateIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Questionnaire Templates*</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={questionnaireTemplates.map(template => ({
                                  value: template.id,
                                  label: template.name
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select questionnaire templates..."
                                testId="select-questionnaire-templates"
                              />
                            </FormControl>
                            <FormDescription>
                              Choose one or more questionnaire templates for this appraisal
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {appraisalType === 'kpi_based' && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="appraisalCycleId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appraisal Cycle*</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-appraisal-cycle">
                                    <SelectValue placeholder="Select appraisal cycle" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {appraisalCycles.map((cycle) => (
                                    <SelectItem key={cycle.id} value={cycle.id}>
                                      {cycle.code} - {cycle.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Select the appraisal cycle for this KPI-based appraisal
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="functionalAreaId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Functional Area</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-functional-area">
                                    <SelectValue placeholder="Select functional area" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {functionalAreas.map((area) => (
                                    <SelectItem key={area.id} value={area.id}>
                                      {area.code} - {area.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Select the functional area
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="kraId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>KRA / Goal*</FormLabel>
                              <Select onValueChange={(val) => {
                                field.onChange(val);
                                handleKraSelection(val);
                              }} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-kra">
                                    <SelectValue placeholder="Select KRA / Goal" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {kraList.map((kra) => (
                                    <SelectItem key={kra.id} value={kra.id}>
                                      {kra.code} - {kra.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Select the KRA / Goal for this appraisal
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {selectedKra && (
                          <div className="space-y-4">
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-medium">Review Frequency: {getReviewFrequencyName(selectedKra.reviewFrequencyId)}</span>
                              </div>
                            </div>

                            {selectedKra.kpis && selectedKra.kpis.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-md font-medium">KPIs & Weightage Configuration</h5>
                                <div className="border rounded-md overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">Code</th>
                                        <th className="px-3 py-2 text-left font-medium">Name</th>
                                        <th className="px-3 py-2 text-left font-medium">Input Type</th>
                                        <th className="px-3 py-2 text-left font-medium">Default Weightage</th>
                                        <th className="px-3 py-2 text-left font-medium">Weightage (%)*</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedKra.kpis.map((kpi, idx) => {
                                        const weightageEntry = kpiWeightages.find(w => w.kpiId === kpi.id);
                                        return (
                                          <tr key={kpi.id} className="border-t">
                                            <td className="px-3 py-2">{kpi.code}</td>
                                            <td className="px-3 py-2">{kpi.name}</td>
                                            <td className="px-3 py-2 capitalize">{kpi.inputType}</td>
                                            <td className="px-3 py-2">{kpi.weightageContribution}%</td>
                                            <td className="px-3 py-2">
                                              <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-20"
                                                value={weightageEntry?.weightage ?? 0}
                                                onChange={(e) => {
                                                  const newWeightages = [...kpiWeightages];
                                                  const existingIdx = newWeightages.findIndex(w => w.kpiId === kpi.id);
                                                  if (existingIdx >= 0) {
                                                    newWeightages[existingIdx] = { ...newWeightages[existingIdx], weightage: Number(e.target.value) || 0 };
                                                  } else {
                                                    newWeightages.push({ kpiId: kpi.id, weightage: Number(e.target.value) || 0 });
                                                  }
                                                  form.setValue('kpiWeightages', newWeightages);
                                                }}
                                                data-testid={`kpi-weightage-${kpi.id}`}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className={`flex items-center gap-2 text-sm ${totalWeightage === 100 ? 'text-green-600' : 'text-red-600'}`}>
                                  <span className="font-medium">Total Weightage: {totalWeightage}%</span>
                                  {totalWeightage !== 100 && (
                                    <span>(Must equal 100%)</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {appraisalType === 'okr_based' && (
                      <div className="space-y-2">
                        <Label>Upload Document*</Label>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                          {uploadedFile ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-500" />
                                <span className="text-sm font-medium">{uploadedFile.name}</span>
                                <Badge variant="secondary">
                                  {(uploadedFile.size / 1024).toFixed(1)} KB
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={removeFile}
                                data-testid="remove-file-btn"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                              <p className="text-muted-foreground mb-2">
                                Upload OKR document
                              </p>
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="document-upload"
                                data-testid="file-input"
                              />
                              <Label htmlFor="document-upload" className="cursor-pointer">
                                <Button type="button" variant="outline" asChild>
                                  <span>Choose File</span>
                                </Button>
                              </Label>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Accepted formats: PDF, DOC, DOCX, XLS, XLSX (Max 10MB)
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Schedule & Timing</h4>
                    
                    {appraisalType === 'kpi_based' ? (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Frequency Calendar: As per Review Frequency of KRA / Goal</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FormField
                          control={form.control}
                          name="frequencyCalendarId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frequency Calendar</FormLabel>
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleCalendarSelection(value);
                                }} 
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-frequency-calendar">
                                    <SelectValue placeholder="Select frequency calendar (optional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {frequencyCalendars.map((calendar) => (
                                    <SelectItem key={calendar.id} value={calendar.id}>
                                      {calendar.code} - {calendar.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Optional: Link to a frequency calendar for automated scheduling
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {selectedCalendarId && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="text-md font-medium">Select Calendar Periods</h5>
                              {isLoadingDetails && (
                                <div className="text-sm text-muted-foreground">Loading details...</div>
                              )}
                            </div>
                            
                            {calendarDetails.length > 0 && (
                              <div className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="selectedCalendarDetailIds"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Frequency Calendar Details*</FormLabel>
                                      <FormControl>
                                        <MultiSelect
                                          options={calendarDetails.map(detail => {
                                            const formatDate = (dateValue: any) => {
                                              const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
                                              return new Date(
                                                date.getFullYear(),
                                                date.getMonth(),
                                                date.getDate()
                                              ).toLocaleDateString();
                                            };
                                            
                                            return {
                                              value: detail.id,
                                              label: `${detail.displayName} (${formatDate(detail.startDate)} - ${formatDate(detail.endDate)})`
                                            };
                                          })}
                                          value={field.value || []}
                                          onChange={handleCalendarDetailSelection}
                                          placeholder="Select calendar periods..."
                                          testId="select-calendar-details"
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Choose one or more calendar periods for this appraisal cycle
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                {selectedCalendarDetailIds.length > 0 && (
                                  <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                      Configure timing settings for selected calendar periods:
                                    </p>
                                    
                                    {calendarDetails
                                      .filter(detail => selectedCalendarDetailIds.includes(detail.id))
                                      .map((detail) => {
                                        const timingIndex = form.getValues('calendarDetailTimings').findIndex(t => t.detailId === detail.id);
                                        if (timingIndex === -1) return null;
                                        return (
                                          <Card key={detail.id} className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                              <div>
                                                <h6 className="font-medium">{detail.displayName}</h6>
                                                <p className="text-sm text-muted-foreground">
                                                  {(() => {
                                                    const formatDate = (dateValue: any) => {
                                                      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
                                                      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString();
                                                    };
                                                    return `${formatDate(detail.startDate)} - ${formatDate(detail.endDate)}`;
                                                  })()}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                              <FormField
                                                control={form.control}
                                                name={`calendarDetailTimings.${timingIndex}.daysToInitiate`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Days to Initiate</FormLabel>
                                                    <FormControl>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        max="365"
                                                        placeholder="0"
                                                        {...field}
                                                        data-testid={`input-days-to-initiate-${detail.id}`}
                                                      />
                                                    </FormControl>
                                                    <FormDescription>
                                                      {whenLabel}
                                                    </FormDescription>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name="whenField"
                                                render={({ field: whenFieldControl }) => (
                                                  <FormItem>
                                                    <FormLabel>When</FormLabel>
                                                    <Select onValueChange={whenFieldControl.onChange} value={whenFieldControl.value}>
                                                      <FormControl>
                                                        <SelectTrigger data-testid={`select-when-${detail.id}`}>
                                                          <SelectValue placeholder="Select" />
                                                        </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                        <SelectItem value="after">After</SelectItem>
                                                        <SelectItem value="before">Before</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                    <FormDescription>
                                                      Before or after period end
                                                    </FormDescription>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`calendarDetailTimings.${timingIndex}.daysToClose`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormLabel>Days to Close*</FormLabel>
                                                    <FormControl>
                                                      <Input
                                                        type="number"
                                                        min="1"
                                                        max="365"
                                                        placeholder="30"
                                                        {...field}
                                                        data-testid={`input-days-to-close-${detail.id}`}
                                                      />
                                                    </FormControl>
                                                    <FormDescription>
                                                      Days after initiation to close
                                                    </FormDescription>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                          </Card>
                                        );
                                      })}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {calendarDetails.length === 0 && !isLoadingDetails && (
                              <Card className="p-6">
                                <div className="text-center text-muted-foreground">
                                  <Calendar className="h-8 w-8 mx-auto mb-2" />
                                  <p>No calendar details found for this frequency calendar.</p>
                                </div>
                              </Card>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {!selectedCalendarId && appraisalType !== 'kpi_based' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="daysToInitiate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Initiate</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="365"
                                  placeholder="0"
                                  value={field.value || 0}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-days-to-initiate"
                                />
                              </FormControl>
                              <FormDescription>
                                {whenLabel}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="whenField"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>When</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-when">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="after">After</SelectItem>
                                  <SelectItem value="before">Before</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Before or after period end
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="daysToClose"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Close*</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="365"
                                  placeholder="30"
                                  value={field.value || 30}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-days-to-close"
                                />
                              </FormControl>
                              <FormDescription>
                                Days after initiation to close
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {appraisalType === 'kpi_based' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="daysToInitiate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Initiate</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="365"
                                  placeholder="0"
                                  value={field.value || 0}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-days-to-initiate"
                                />
                              </FormControl>
                              <FormDescription>
                                {whenLabel}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="whenField"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>When</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-when">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="after">After</SelectItem>
                                  <SelectItem value="before">Before</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Before or after period end
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="daysToClose"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Days to Close*</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="365"
                                  placeholder="30"
                                  value={field.value || 30}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-days-to-close"
                                />
                              </FormControl>
                              <FormDescription>
                                Days after initiation to close
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Employee Exclusions</h4>
                    
                    <FormField
                      control={form.control}
                      name="excludeTenureLessThanYear"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Exclude employees with tenure less than 1 year
                            </FormLabel>
                            <FormDescription>
                              Automatically exclude employees who joined less than a year ago
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-exclude-tenure"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <Label>Exclude by Date of Joining (DOJ)</Label>
                      <p className="text-sm text-muted-foreground">
                        Exclude employees based on their date of joining
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="excludeDojFromDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DOJ From Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start text-left font-normal"
                                      data-testid="exclude-doj-from-date"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                Exclude employees who joined from this date
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="excludeDojTillDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>DOJ Till Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start text-left font-normal"
                                      data-testid="exclude-doj-till-date"
                                    >
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription>
                                Exclude employees who joined till this date
                              </FormDescription>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Exclude Specific Employees</Label>
                      <p className="text-sm text-muted-foreground">
                        Select individual employees to exclude from this appraisal cycle
                      </p>
                      
                      <ScrollArea className="h-40 border rounded-md p-4">
                        <div className="space-y-2">
                          {selectedGroup.members.filter((member) => {
                            const dojFromDate = form.watch('excludeDojFromDate');
                            const dojTillDate = form.watch('excludeDojTillDate');
                            
                            if (dojFromDate) {
                              if (!member.dateOfJoining) return false;
                              const memberDoj = new Date(member.dateOfJoining);
                              const fromDate = new Date(dojFromDate);
                              fromDate.setHours(0, 0, 0, 0);
                              memberDoj.setHours(0, 0, 0, 0);
                              if (memberDoj < fromDate) return false;
                            }
                            
                            if (dojTillDate) {
                              if (!member.dateOfJoining) return false;
                              const memberDoj = new Date(member.dateOfJoining);
                              const tillDate = new Date(dojTillDate);
                              tillDate.setHours(23, 59, 59, 999);
                              memberDoj.setHours(0, 0, 0, 0);
                              if (memberDoj > tillDate) return false;
                            }
                            
                            return true;
                          }).map((member) => {
                            const isExcluded = form.watch('excludedEmployeeIds').includes(member.id);
                            return (
                              <div key={member.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`exclude-${member.id}`}
                                  checked={isExcluded}
                                  onCheckedChange={(checked) => {
                                    const currentExcluded = form.getValues('excludedEmployeeIds');
                                    if (checked) {
                                      form.setValue('excludedEmployeeIds', [...currentExcluded, member.id]);
                                    } else {
                                      form.setValue('excludedEmployeeIds', currentExcluded.filter(id => id !== member.id));
                                    }
                                  }}
                                  data-testid={`checkbox-exclude-${member.id}`}
                                />
                                <Label htmlFor={`exclude-${member.id}`} className="text-sm font-normal">
                                  {member.firstName} {member.lastName} ({member.email})
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Publish Options</h4>
                    
                    <FormField
                      control={form.control}
                      name="publishType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>When should the appraisal be published?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="now" id="publish-now" data-testid="radio-publish-now" />
                                <Label htmlFor="publish-now" className="font-normal cursor-pointer">
                                  <div>
                                    <div className="font-medium">Publish Now</div>
                                    <div className="text-sm text-muted-foreground">
                                      Immediately initiate the questionnaire to all employees in the selected appraisal group
                                    </div>
                                  </div>
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="as_per_calendar" id="publish-calendar" data-testid="radio-publish-calendar" />
                                <Label htmlFor="publish-calendar" className="font-normal cursor-pointer">
                                  <div>
                                    <div className="font-medium">Publish As Per Calendar</div>
                                    <div className="text-sm text-muted-foreground">
                                      Publish the questionnaire on the scheduled date (end date of frequency calendar + days to initiate)
                                    </div>
                                  </div>
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch('publishType') === 'as_per_calendar' && appraisalType !== 'kpi_based' && selectedCalendarDetailIds.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Scheduled Publishing:</strong> The appraisal will be published to employees based on each selected calendar period's end date plus the configured "Days to Initiate" value.
                        </p>
                        {form.watch('calendarDetailTimings').map((timing: any) => {
                          const detail = calendarDetails.find(d => d.id === timing.detailId);
                          if (!detail) return null;
                          
                          const endDateValue = detail.endDate;
                          const tempDate = endDateValue instanceof Date ? endDateValue : new Date(endDateValue);
                          const endDate = new Date(
                            tempDate.getFullYear(),
                            tempDate.getMonth(),
                            tempDate.getDate()
                          );
                          
                          const daysValue = Number(timing.daysToInitiate) || 0;
                          const scheduledDate = new Date(endDate);
                          if (whenField === 'before') {
                            scheduledDate.setDate(scheduledDate.getDate() - daysValue);
                          } else {
                            scheduledDate.setDate(scheduledDate.getDate() + daysValue);
                          }
                          
                          return (
                            <p key={timing.detailId} className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                              • {detail.displayName}: Will be published on <strong>{scheduledDate.toLocaleDateString()}</strong> ({endDate.toLocaleDateString()} {whenField === 'before' ? '-' : '+'} {daysValue} {daysValue === 1 ? 'day' : 'days'})
                            </p>
                          );
                        })}
                      </div>
                    )}

                    {form.watch('publishType') === 'as_per_calendar' && appraisalType === 'kpi_based' && selectedKra && selectedKra.reviewFrequencyId && (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Scheduled Publishing (KPI Based):</strong> The appraisal will be published based on the review frequency of the selected KRA / Goal.
                        </p>
                        {(() => {
                          const freq = reviewFrequencies.find(f => f.id === selectedKra.reviewFrequencyId);
                          const freqDesc = freq ? freq.description : 'Unknown';
                          const daysValue = Number(form.getValues('daysToInitiate')) || 0;
                          
                          let exampleEndDate = new Date();
                          const freqCode = freq?.code?.toLowerCase() || '';
                          if (freqCode.includes('month')) {
                            exampleEndDate = new Date(exampleEndDate.getFullYear(), exampleEndDate.getMonth() + 1, 0);
                          } else if (freqCode.includes('quarter')) {
                            const currentQuarter = Math.floor(exampleEndDate.getMonth() / 3);
                            exampleEndDate = new Date(exampleEndDate.getFullYear(), (currentQuarter + 1) * 3, 0);
                          } else if (freqCode.includes('half') || freqCode.includes('semi')) {
                            const currentHalf = exampleEndDate.getMonth() < 6 ? 0 : 1;
                            exampleEndDate = new Date(exampleEndDate.getFullYear(), (currentHalf + 1) * 6, 0);
                          } else if (freqCode.includes('annual') || freqCode.includes('year')) {
                            exampleEndDate = new Date(exampleEndDate.getFullYear(), 11, 31);
                          } else {
                            exampleEndDate = new Date(exampleEndDate.getFullYear(), exampleEndDate.getMonth() + 1, 0);
                          }

                          const publishDate = new Date(exampleEndDate);
                          if (whenField === 'before') {
                            publishDate.setDate(publishDate.getDate() - daysValue);
                          } else {
                            publishDate.setDate(publishDate.getDate() + daysValue);
                          }

                          return (
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                              • Example ({freqDesc}): Period ending <strong>{exampleEndDate.toLocaleDateString()}</strong> {whenField === 'before' ? '-' : '+'} {daysValue} {daysValue === 1 ? 'day' : 'days'} = Publish on <strong>{publishDate.toLocaleDateString()}</strong>
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInitiateFormOpen(false)}
                      data-testid="cancel-btn"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={initiateMutation.isPending || (appraisalType === 'kpi_based' && !isWeightageValid)}
                      data-testid="initiate-submit-btn"
                    >
                      {initiateMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Initiating...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Initiate Appraisal
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
