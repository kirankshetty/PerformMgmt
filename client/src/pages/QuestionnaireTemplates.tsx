import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuestionnaireTemplateSchema, type QuestionnaireTemplate, type InsertQuestionnaireTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Copy, Edit, FileText, GripVertical, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'rating' | 'textarea';
  required: boolean;
}

interface SortableQuestionProps {
  question: Question;
  index: number;
  updateQuestion: (id: string, field: keyof Question, value: any) => void;
  removeQuestion: (id: string) => void;
}

function SortableQuestion({ question, index, updateQuestion, removeQuestion }: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: question.id,
    // Add data for better drag detection
    data: {
      type: 'Question',
      question,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`${isDragging ? 'z-50' : ''}`}
    >
      <Card className={`p-4 ${isDragging ? 'shadow-lg ring-2 ring-primary/20 bg-background' : ''}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                {...attributes} 
                {...listeners} 
                className="cursor-grab hover:cursor-grabbing p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 touch-none"
                data-testid={`drag-handle-${question.id}`}
                aria-label={`Drag to reorder question ${index + 1}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>
              <h4 className="font-medium">Question {index + 1}</h4>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeQuestion(question.id)}
              data-testid={`remove-question-${question.id}`}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                placeholder="Enter question text..."
                value={question.text}
                onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                data-testid={`input-question-text-${question.id}`}
              />
            </div>
            <Select
              value={question.type}
              onValueChange={(value) => updateQuestion(question.id, 'type', value)}
            >
              <SelectTrigger data-testid={`select-question-type-${question.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Long Text</SelectItem>
                <SelectItem value="rating">Rating (1-5)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 mt-3">
            <Checkbox
              id={`required-${question.id}`}
              checked={question.required}
              onCheckedChange={(checked) => updateQuestion(question.id, 'required', checked)}
              data-testid={`checkbox-question-required-${question.id}`}
            />
            <label 
              htmlFor={`required-${question.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Required
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function QuestionnaireTemplates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<QuestionnaireTemplate[]>({
    queryKey: ["/api/questionnaire-templates"],
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
  });

  const { data: levels = [] } = useQuery<any[]>({
    queryKey: ["/api/levels"],
  });

  const { data: grades = [] } = useQuery<any[]>({
    queryKey: ["/api/grades"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: InsertQuestionnaireTemplate) => {
      await apiRequest("POST", "/api/questionnaire-templates", templateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-templates"] });
      setIsCreateModalOpen(false);
      toast({
        title: "Success",
        description: "Questionnaire template created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create questionnaire template",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, templateData }: { id: string; templateData: Partial<InsertQuestionnaireTemplate> }) => {
      await apiRequest("PUT", `/api/questionnaire-templates/${id}`, templateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-templates"] });
      setEditingTemplate(null);
      toast({
        title: "Success",
        description: "Questionnaire template updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update questionnaire template",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/questionnaire-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-templates"] });
      toast({
        title: "Success",
        description: "Questionnaire template deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete questionnaire template",
        variant: "destructive",
      });
    },
  });

  const copyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("POST", `/api/questionnaire-templates/${templateId}/copy`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire-templates"] });
      toast({
        title: "Success",
        description: "Template copied successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to copy this template",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to copy template",
          variant: "destructive",
        });
      }
    },
  });

  const form = useForm<InsertQuestionnaireTemplate>({
    resolver: zodResolver(insertQuestionnaireTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      targetRole: "employee",
      applicableLevelId: null,
      applicableGradeId: null,
      applicableLocationId: null,
      sendOnMail: false,
      questions: [],
      status: "active",
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newQuestions = arrayMove(questions, oldIndex, newIndex);
        setQuestions(newQuestions);
        // Sync form field with local state
        form.setValue("questions", newQuestions);
      }
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: "",
      type: "text",
      required: true,
    };
    const newQuestions = [...questions, newQuestion];
    setQuestions(newQuestions);
    // Sync form field with local state
    form.setValue("questions", newQuestions);
  };

  const removeQuestion = (id: string) => {
    const newQuestions = questions.filter(q => q.id !== id);
    setQuestions(newQuestions);
    // Sync form field with local state
    form.setValue("questions", newQuestions);
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    const newQuestions = questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    );
    setQuestions(newQuestions);
    // Sync form field with local state
    form.setValue("questions", newQuestions);
  };

  const onSubmit = (data: InsertQuestionnaireTemplate) => {
    const templateData = {
      ...data,
      questions: questions,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, templateData });
    } else {
      createTemplateMutation.mutate(templateData);
    }
  };

  const handleEdit = (template: QuestionnaireTemplate) => {
    setEditingTemplate(template);
    const templateQuestions = (template.questions as Question[]) || [];
    form.reset({
      name: template.name,
      description: template.description || "",
      targetRole: template.targetRole,
      applicableLevelId: template.applicableLevelId || null,
      applicableGradeId: template.applicableGradeId || null,
      applicableLocationId: template.applicableLocationId || null,
      sendOnMail: template.sendOnMail || false,
      status: template.status || "active",
      questions: templateQuestions, // Include questions in form reset
    });
    setQuestions(templateQuestions);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this questionnaire template?")) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const handleCopy = (id: string) => {
    copyTemplateMutation.mutate(id);
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setQuestions([]);
    form.reset({
      name: "",
      description: "",
      targetRole: "employee",
      applicableLevelId: null,
      applicableGradeId: null,
      applicableLocationId: null,
      sendOnMail: false,
      questions: [],
      status: "active",
    });
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = searchQuery === "" || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "" || template.targetRole === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  return (
    <RoleGuard allowedRoles={["admin", "hr_manager"]}>
      <div className="space-y-6" data-testid="questionnaire-templates">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Questionnaire Templates</h1>
            <p className="text-muted-foreground">Manage performance review questionnaire templates</p>
          </div>
          <Dialog open={isCreateModalOpen || !!editingTemplate} onOpenChange={(open) => {
            // Only close dialog if user explicitly wants to close it, not during form interactions
            if (!open && !updateTemplateMutation.isPending && !createTemplateMutation.isPending) {
              setIsCreateModalOpen(false);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateModalOpen(true)} data-testid="add-template-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit Template" : "Add New Template"}</DialogTitle>
                <DialogDescription>
                  {editingTemplate ? "Update questionnaire template" : "Create a new questionnaire template"}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Q4 2023 Employee Review" data-testid="input-template-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="targetRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-target-role">
                                <SelectValue placeholder="Select target role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} placeholder="Template description..." data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Enhanced Fields */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Applicability Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="applicableLevelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Applicable Level</FormLabel>
                            <Select onValueChange={(v) => field.onChange(v || null)} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-applicable-level">
                                  <SelectValue placeholder="All Levels" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All Levels</SelectItem>
                                {levels.map((level: any) => (
                                  <SelectItem key={level.id} value={level.id}>
                                    {level.description} ({level.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="applicableGradeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Applicable Grade</FormLabel>
                            <Select onValueChange={(v) => field.onChange(v || null)} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-applicable-grade">
                                  <SelectValue placeholder="All Grades" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All Grades</SelectItem>
                                {grades.map((grade: any) => (
                                  <SelectItem key={grade.id} value={grade.id}>
                                    {grade.description} ({grade.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="applicableLocationId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Applicable Location</FormLabel>
                            <Select onValueChange={(v) => field.onChange(v || null)} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-applicable-location">
                                  <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All Locations</SelectItem>
                                {locations.map((location: any) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sendOnMail"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-send-on-mail"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Send on Mail
                              </FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Email this questionnaire to participants automatically
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Questions Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Questions</h3>
                      <Button type="button" onClick={addQuestion} variant="outline" size="sm" data-testid="add-question">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Question
                      </Button>
                    </div>

                    {questions.length > 0 ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-3">
                            {questions.map((question, index) => (
                              <SortableQuestion
                                key={question.id}
                                question={question}
                                index={index}
                                updateQuestion={updateQuestion}
                                removeQuestion={removeQuestion}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No questions added yet</p>
                        <p className="text-sm text-muted-foreground">Click "Add Question" to get started</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        resetForm();
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                      data-testid="submit-template"
                    >
                      {editingTemplate ? "Update Template" : "Create Template"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-templates"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]" data-testid="filter-role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded mb-4"></div>
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))
          ) : filteredTemplates.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">No templates found</p>
              <p className="text-muted-foreground text-sm">Create your first questionnaire template</p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <Card key={template.id} data-testid={`template-card-${template.id}`} className="relative">
                <CardContent className="p-6 pt-12">
                  {/* Action buttons positioned at top-right corner */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <RoleGuard allowedRoles={['admin', 'hr_manager']}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(template.id)}
                        disabled={copyTemplateMutation.isPending}
                        data-testid={`copy-template-${template.id}`}
                        title="Copy Template"
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </RoleGuard>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      data-testid={`edit-template-${template.id}`}
                      title="Edit Template"
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      data-testid={`delete-template-${template.id}`}
                      title="Delete Template"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Card content */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate" data-testid={`template-name-${template.id}`}>
                        {template.name}
                      </h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">
                          {template.targetRole}
                        </Badge>
                        <Badge variant={template.status === 'active' ? 'default' : 'secondary'}>
                          {template.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {template.description && <p>{template.description}</p>}
                    <p>Questions: {Array.isArray(template.questions) ? template.questions.length : 0}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
