"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  Copy,
  MoreHorizontal,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Settings,
  Bell,
  GitBranch,
  Server,
  Activity,
  TrendingUp,
  Shield,
  Timer,
  Filter,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Textarea } from "@/app/components/ui/textarea";
import { useToast } from "@/app/components/ui/use-toast";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: {
    type: "schedule" | "event" | "metric" | "webhook" | "manual";
    config: Record<string, any>;
  };
  conditions: Condition[];
  actions: Action[];
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  runCount: number;
  successCount: number;
}

interface Condition {
  id: string;
  type: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "regex";
  value: any;
  field?: string;
}

interface Action {
  id: string;
  type: string;
  config: Record<string, any>;
  delay?: number;
  retryCount?: number;
}

const triggerTypes = [
  { value: "schedule", label: "Scheduled", icon: Clock, description: "Run on a schedule (cron)" },
  { value: "event", label: "Event-Based", icon: Bell, description: "Trigger on system events" },
  { value: "metric", label: "Metric Threshold", icon: Activity, description: "When metrics cross thresholds" },
  { value: "webhook", label: "Webhook", icon: Zap, description: "External webhook trigger" },
  { value: "manual", label: "Manual", icon: Play, description: "Run manually only" },
];

const conditionTypes = [
  { value: "service_status", label: "Service Status", description: "Check if service is healthy/degraded/unhealthy" },
  { value: "cpu_usage", label: "CPU Usage", description: "CPU utilization percentage" },
  { value: "memory_usage", label: "Memory Usage", description: "Memory utilization percentage" },
  { value: "disk_usage", label: "Disk Usage", description: "Disk utilization percentage" },
  { value: "uptime", label: "Uptime", description: "Service uptime duration" },
  { value: "error_rate", label: "Error Rate", description: "Error rate percentage" },
  { value: "response_time", label: "Response Time", description: "API response time in ms" },
  { value: "custom_metric", label: "Custom Metric", description: "Any custom metric value" },
];

const actionTypes = [
  { value: "restart_service", label: "Restart Service", icon: Server, description: "Restart the affected service" },
  { value: "scale_up", label: "Scale Up", icon: TrendingUp, description: "Increase service replicas/instances" },
  { value: "scale_down", label: "Scale Down", icon: TrendingUp, description: "Decrease service replicas/instances" },
  { value: "send_notification", label: "Send Notification", icon: Bell, description: "Send Discord/Email/Slack alert" },
  { value: "run_webhook", label: "Run Webhook", icon: Zap, description: "Call external webhook URL" },
  { value: "trigger_pipeline", label: "Trigger Pipeline", icon: GitBranch, description: "Start CI/CD pipeline" },
  { value: "backup_data", label: "Backup Data", icon: Shield, description: "Create database backup" },
  { value: "rollback_deployment", label: "Rollback", icon: Timer, description: "Rollback to previous version" },
  { value: "execute_command", label: "Execute Command", icon: Settings, description: "Run custom command" },
];

export default function AutomationRulesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rules");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: "",
    description: "",
    enabled: true,
    trigger: { type: "event", config: {} },
    conditions: [],
    actions: [],
  });

  // Mock data - in real app, fetch from API
  const rules: AutomationRule[] = [
    {
      id: "1",
      name: "Auto-Restart Failed Services",
      description: "Automatically restart services that have crashed or become unhealthy",
      enabled: true,
      trigger: { type: "event", config: { event: "service_unhealthy" } },
      conditions: [
        { id: "c1", type: "service_status", operator: "equals", value: "unhealthy" },
      ],
      actions: [
        { id: "a1", type: "restart_service", config: {}, delay: 0, retryCount: 3 },
        { id: "a2", type: "send_notification", config: { channel: "discord" }, delay: 5 },
      ],
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-20T15:30:00Z",
      lastRun: "2024-01-25T08:15:00Z",
      runCount: 12,
      successCount: 11,
    },
    {
      id: "2",
      name: "Scale Up on High CPU",
      description: "Automatically scale services when CPU usage exceeds 80% for 5 minutes",
      enabled: true,
      trigger: { type: "metric", config: { metric: "cpu", threshold: 80, duration: 300 } },
      conditions: [
        { id: "c1", type: "cpu_usage", operator: "greater_than", value: 80 },
      ],
      actions: [
        { id: "a1", type: "scale_up", config: { replicas: 2 }, delay: 0 },
        { id: "a2", type: "send_notification", config: { channel: "discord" }, delay: 0 },
      ],
      createdAt: "2024-01-10T09:00:00Z",
      updatedAt: "2024-01-22T11:45:00Z",
      lastRun: "2024-01-24T14:20:00Z",
      runCount: 5,
      successCount: 5,
    },
    {
      id: "3",
      name: "Daily Database Backup",
      description: "Create a backup of all databases every day at 2 AM UTC",
      enabled: true,
      trigger: { type: "schedule", config: { cron: "0 2 * * *", timezone: "UTC" } },
      conditions: [],
      actions: [
        { id: "a1", type: "backup_data", config: { type: "full" }, delay: 0 },
      ],
      createdAt: "2024-01-05T08:00:00Z",
      updatedAt: "2024-01-25T10:00:00Z",
      runCount: 20,
      successCount: 20,
    },
    {
      id: "4",
      name: "Memory Alert & Restart",
      description: "Alert and restart services with memory usage over 90%",
      enabled: false,
      trigger: { type: "metric", config: { metric: "memory", threshold: 90 } },
      conditions: [
        { id: "c1", type: "memory_usage", operator: "greater_than", value: 90 },
      ],
      actions: [
        { id: "a1", type: "send_notification", config: { channel: "discord", priority: "high" } },
        { id: "a2", type: "restart_service", config: {}, delay: 60, retryCount: 1 },
      ],
      createdAt: "2024-01-12T14:30:00Z",
      updatedAt: "2024-01-18T16:20:00Z",
      runCount: 8,
      successCount: 7,
    },
  ];

  const handleCreateRule = () => {
    if (!newRule.name) {
      toast({ title: "Rule name is required", variant: "destructive" });
      return;
    }

    toast({
      title: "Rule created",
      description: `"${newRule.name}" has been created successfully`,
    });
    setShowCreateDialog(false);
    setNewRule({
      name: "",
      description: "",
      enabled: true,
      trigger: { type: "event", config: {} },
      conditions: [],
      actions: [],
    });
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    toast({
      title: enabled ? "Rule enabled" : "Rule disabled",
      description: `Automation rule has been ${enabled ? "enabled" : "disabled"}`,
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    toast({
      title: "Rule deleted",
      description: "The automation rule has been deleted",
    });
  };

  const handleRunRule = (ruleId: string) => {
    toast({
      title: "Rule execution started",
      description: "Running automation rule manually...",
    });
  };

  const addCondition = () => {
    setNewRule((prev) => ({
      ...prev,
      conditions: [
        ...(prev.conditions || []),
        { id: Date.now().toString(), type: "service_status", operator: "equals", value: "" },
      ],
    }));
  };

  const removeCondition = (conditionId: string) => {
    setNewRule((prev) => ({
      ...prev,
      conditions: prev.conditions?.filter((c) => c.id !== conditionId) || [],
    }));
  };

  const addAction = () => {
    setNewRule((prev) => ({
      ...prev,
      actions: [
        ...(prev.actions || []),
        { id: Date.now().toString(), type: "send_notification", config: {} },
      ],
    }));
  };

  const removeAction = (actionId: string) => {
    setNewRule((prev) => ({
      ...prev,
      actions: prev.actions?.filter((a) => a.id !== actionId) || [],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Rules Engine</h1>
          <p className="text-sm text-gray-400">
            Create custom automation rules with triggers, conditions, and actions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-gray-700 bg-[#1a1d24] text-white hover:bg-[#2a2e3a]"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <Play className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Rules</p>
              <p className="text-2xl font-bold text-white">
                {rules.filter((r) => r.enabled).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Runs</p>
              <p className="text-2xl font-bold text-white">
                {rules.reduce((acc, r) => acc + r.runCount, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
              <Zap className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold text-white">
                {Math.round(
                  (rules.reduce((acc, r) => acc + r.successCount, 0) /
                    Math.max(1, rules.reduce((acc, r) => acc + r.runCount, 0))) *
                    100
                )}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Last 24h Runs</p>
              <p className="text-2xl font-bold text-white">47</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-gray-800 bg-[#1a1d24]">
          <TabsTrigger
            value="rules"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Rules
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Execution History
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4 space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="border-gray-800 bg-[#1a1d24]">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${
                        rule.enabled
                          ? "bg-green-500/20 text-green-500"
                          : "bg-gray-500/20 text-gray-500"
                      }`}
                    >
                      {rule.enabled ? (
                        <Zap className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{rule.name}</h3>
                        <Badge
                          variant="outline"
                          className={`${
                            rule.enabled
                              ? "border-green-500/50 bg-green-500/10 text-green-400"
                              : "border-gray-500/50 bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {rule.enabled ? "Active" : "Disabled"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-blue-500/50 bg-blue-500/10 text-blue-400"
                        >
                          {triggerTypes.find((t) => t.value === rule.trigger.type)?.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{rule.description}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span>Runs: {rule.runCount}</span>
                        <span>Success: {rule.successCount}</span>
                        <span>Success Rate: {Math.round((rule.successCount / Math.max(1, rule.runCount)) * 100)}%</span>
                        {rule.lastRun && (
                          <span>Last run: {new Date(rule.lastRun).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                      className="data-[state=checked]:bg-green-600"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunRule(rule.id)}
                      className="text-gray-400 hover:text-white"
                      disabled={!rule.enabled}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                      className="text-gray-400"
                    >
                      {expandedRule === rule.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-gray-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="border-gray-800 bg-[#1a1d24]">
                        <DropdownMenuItem
                          onClick={() => setEditingRule(rule)}
                          className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white">
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-800" />
                        <DropdownMenuItem
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-400 focus:bg-[#2a2e3a] focus:text-red-300"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {expandedRule === rule.id && (
                  <div className="mt-4 border-t border-gray-800 pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-white">Conditions</h4>
                        <div className="space-y-2">
                          {rule.conditions.length === 0 ? (
                            <p className="text-sm text-gray-500">No conditions (always runs)</p>
                          ) : (
                            rule.conditions.map((condition) => (
                              <div
                                key={condition.id}
                                className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#14161c] p-2"
                              >
                                <span className="text-sm text-gray-400">
                                  {conditionTypes.find((t) => t.value === condition.type)?.label}
                                </span>
                                <span className="text-xs text-gray-500">{condition.operator}</span>
                                <span className="text-sm text-white">{condition.value}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-white">Actions</h4>
                        <div className="space-y-2">
                          {rule.actions.map((action, index) => (
                            <div
                              key={action.id}
                              className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#14161c] p-2"
                            >
                              <span className="text-xs text-gray-500">{index + 1}.</span>
                              {(() => {
                                const Icon = actionTypes.find((t) => t.value === action.type)?.icon;
                                return Icon ? <Icon className="h-4 w-4 text-blue-400" /> : null;
                              })()}
                              <span className="text-sm text-gray-300">
                                {actionTypes.find((t) => t.value === action.type)?.label}
                              </span>
                              {action.delay && action.delay > 0 && (
                                <Badge variant="outline" className="text-xs border-gray-700">
                                  +{action.delay}s delay
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-gray-800 bg-[#1a1d24] p-6">
            <div className="text-center text-gray-400">
              <Clock className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">Execution history will appear here</p>
              <p className="text-sm">Track all automation runs and their outcomes</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Auto-Restart on Failure",
                description: "Restart services automatically when they crash",
                icon: Server,
                color: "blue",
              },
              {
                name: "High CPU Auto-Scale",
                description: "Scale up when CPU exceeds threshold",
                icon: TrendingUp,
                color: "green",
              },
              {
                name: "Daily Backup",
                description: "Create database backups on schedule",
                icon: Shield,
                color: "purple",
              },
              {
                name: "Error Rate Alert",
                description: "Alert when error rate spikes",
                icon: AlertTriangle,
                color: "orange",
              },
              {
                name: "Auto-Deploy on Push",
                description: "Deploy when code is pushed to main",
                icon: GitBranch,
                color: "cyan",
              },
              {
                name: "Memory Leak Fix",
                description: "Restart when memory usage is high",
                icon: Activity,
                color: "red",
              },
            ].map((template, i) => (
              <Card
                key={i}
                className="cursor-pointer border-gray-800 bg-[#1a1d24] p-4 transition-all hover:border-gray-700 hover:bg-[#1f232b]"
                onClick={() => {
                  setNewRule({
                    name: template.name,
                    description: template.description,
                    enabled: true,
                    trigger: { type: "event", config: {} },
                    conditions: [],
                    actions: [],
                  });
                  setShowCreateDialog(true);
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${template.color}-500/20`}
                  >
                    <template.icon className={`h-5 w-5 text-${template.color}-500`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{template.name}</h4>
                    <p className="text-sm text-gray-400">{template.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-gray-800 bg-[#1a1d24] text-white">
          <DialogHeader>
            <DialogTitle>Create Automation Rule</DialogTitle>
            <DialogDescription className="text-gray-400">
              Define triggers, conditions, and actions for your automation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <label className="mb-2 block text-sm text-gray-300">Rule Name *</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g., Auto-Restart Failed Services"
                className="w-full rounded-md border border-gray-700 bg-[#14161c] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">Description</label>
              <Textarea
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                placeholder="Describe what this automation does..."
                className="border-gray-700 bg-[#14161c] text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">Trigger Type</label>
              <div className="grid gap-2 md:grid-cols-2">
                {triggerTypes.map((trigger) => (
                  <button
                    key={trigger.value}
                    onClick={() =>
                      setNewRule({
                        ...newRule,
                        trigger: { type: trigger.value as any, config: {} },
                      })
                    }
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      newRule.trigger?.type === trigger.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-800 bg-[#14161c] hover:border-gray-700"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                      <trigger.icon className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{trigger.label}</p>
                      <p className="text-xs text-gray-500">{trigger.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm text-gray-300">Conditions (Optional)</label>
                <Button variant="ghost" size="sm" onClick={addCondition} className="text-blue-400">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Condition
                </Button>
              </div>
              <div className="space-y-2">
                {newRule.conditions?.length === 0 ? (
                  <p className="text-sm text-gray-500">No conditions - rule will always trigger</p>
                ) : (
                  newRule.conditions?.map((condition) => (
                    <div key={condition.id} className="flex items-center gap-2">
                      <Select
                        value={condition.type}
                        onValueChange={(value) => {
                          setNewRule((prev) => ({
                            ...prev,
                            conditions: prev.conditions?.map((c) =>
                              c.id === condition.id ? { ...c, type: value } : c
                            ),
                          }));
                        }}
                      >
                        <SelectTrigger className="w-[180px] border-gray-700 bg-[#14161c] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-gray-800 bg-[#1a1d24]">
                          {conditionTypes.map((type) => (
                            <SelectItem
                              key={type.value}
                              value={type.value}
                              className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                            >
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={condition.operator}
                        onValueChange={(value) => {
                          setNewRule((prev) => ({
                            ...prev,
                            conditions: prev.conditions?.map((c) =>
                              c.id === condition.id ? { ...c, operator: value as any } : c
                            ),
                          }));
                        }}
                      >
                        <SelectTrigger className="w-[140px] border-gray-700 bg-[#14161c] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-gray-800 bg-[#1a1d24]">
                          <SelectItem
                            value="equals"
                            className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                          >
                            equals
                          </SelectItem>
                          <SelectItem
                            value="not_equals"
                            className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                          >
                            not equals
                          </SelectItem>
                          <SelectItem
                            value="greater_than"
                            className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                          >
                            greater than
                          </SelectItem>
                          <SelectItem
                            value="less_than"
                            className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                          >
                            less than
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => {
                          setNewRule((prev) => ({
                            ...prev,
                            conditions: prev.conditions?.map((c) =>
                              c.id === condition.id ? { ...c, value: e.target.value } : c
                            ),
                          }));
                        }}
                        placeholder="Value"
                        className="flex-1 rounded-md border border-gray-700 bg-[#14161c] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCondition(condition.id)}
                        className="text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm text-gray-300">Actions</label>
                <Button variant="ghost" size="sm" onClick={addAction} className="text-blue-400">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Action
                </Button>
              </div>
              <div className="space-y-2">
                {newRule.actions?.length === 0 ? (
                  <p className="text-sm text-gray-500">Add at least one action</p>
                ) : (
                  newRule.actions?.map((action, index) => (
                    <div
                      key={action.id}
                      className="rounded-lg border border-gray-800 bg-[#14161c] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{index + 1}.</span>
                        <Select
                          value={action.type}
                          onValueChange={(value) => {
                            setNewRule((prev) => ({
                              ...prev,
                              actions: prev.actions?.map((a) =>
                                a.id === action.id ? { ...a, type: value } : a
                              ),
                            }));
                          }}
                        >
                          <SelectTrigger className="w-[200px] border-gray-700 bg-[#14161c] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-gray-800 bg-[#1a1d24]">
                            {actionTypes.map((type) => (
                              <SelectItem
                                key={type.value}
                                value={type.value}
                                className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                              >
                                <div className="flex items-center gap-2">
                                  <type.icon className="h-4 w-4" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <input
                          type="number"
                          value={action.delay || 0}
                          onChange={(e) => {
                            setNewRule((prev) => ({
                              ...prev,
                              actions: prev.actions?.map((a) =>
                                a.id === action.id
                                  ? { ...a, delay: parseInt(e.target.value) || 0 }
                                  : a
                              ),
                            }));
                          }}
                          placeholder="Delay (s)"
                          className="w-[100px] rounded-md border border-gray-700 bg-[#14161c] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAction(action.id)}
                          className="ml-auto text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {actionTypes.find((t) => t.value === action.type)?.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateRule}
              disabled={!newRule.name || newRule.actions?.length === 0}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
