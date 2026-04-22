"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Play,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  GitBranch,
  GitCommit,
  ChevronDown,
  ChevronRight,
  Terminal,
  AlertCircle,
  CheckCircle2,
  X,
  Timer,
  MoreHorizontal,
  Filter,
  RefreshCw,
  Zap,
  GitMerge,
  StopCircle,
  History,
  FileCode,
  Eye,
  Settings,
  Bell,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { useToast } from "@/app/components/ui/use-toast";
import {
  usePipelines,
  usePipeline,
  usePipelineLogs,
  useTriggerPipeline,
  useCancelPipeline,
  useApprovePipeline,
  useRollbackPipeline,
} from "@/app/hooks/use-git";
import {
  useRepositories,
  useRepositoryBranches,
} from "@/app/hooks/use-git";

interface PipelineRun {
  id: string;
  pipelineId: string;
  status: "running" | "success" | "failed" | "cancelled" | "pending";
  branch: string;
  commit: string;
  commitMessage: string;
  author: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  stages: PipelineStage[];
  service: {
    id: string;
    name: string;
    type: string;
  };
  triggeredBy: string;
  triggerType: "manual" | "webhook" | "schedule";
}

interface PipelineStage {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    running: "bg-blue-500",
    success: "bg-green-500",
    failed: "bg-red-500",
    cancelled: "bg-gray-500",
    pending: "bg-yellow-500",
    waiting: "bg-orange-500",
  };
  return colors[status] || "bg-gray-400";
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, React.ReactNode> = {
    running: <RefreshCw className="h-4 w-4 animate-spin" />,
    success: <CheckCircle2 className="h-4 w-4" />,
    failed: <XCircle className="h-4 w-4" />,
    cancelled: <StopCircle className="h-4 w-4" />,
    pending: <Clock className="h-4 w-4" />,
    waiting: <AlertCircle className="h-4 w-4" />,
  };
  return icons[status] || <Clock className="h-4 w-4" />;
};

const formatDuration = (seconds?: number) => {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

export default function PipelinesPage() {
  const { toast } = useToast();
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [manualCommit, setManualCommit] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const { data: pipelines, isLoading: isLoadingPipelines } = usePipelines();
  const { data: selectedPipelineData, isLoading: isLoadingPipeline } =
    usePipeline(selectedPipeline);
  const { data: pipelineLogs, isLoading: isLoadingLogs } = usePipelineLogs(
    selectedPipeline,
    selectedPipelineData?.runs?.[0]?.id
  );
  const { data: repositories } = useRepositories();
  const { data: branches } = useRepositoryBranches(selectedRepo);

  const triggerPipeline = useTriggerPipeline();
  const cancelPipeline = useCancelPipeline();
  const approvePipeline = useApprovePipeline();
  const rollbackPipeline = useRollbackPipeline();

  const handleTrigger = async () => {
    try {
      await triggerPipeline.mutateAsync({
        repositoryId: selectedRepo,
        branch: selectedBranch,
        commit: manualCommit || undefined,
      });
      toast({
        title: "Pipeline triggered",
        description: `Started deployment for ${selectedBranch}`,
      });
      setShowTriggerDialog(false);
    } catch (error) {
      toast({
        title: "Failed to trigger",
        description: "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    if (!selectedRun) return;
    try {
      await cancelPipeline.mutateAsync({
        pipelineId: selectedPipeline!,
        runId: selectedRun.id,
        reason: cancelReason,
      });
      toast({
        title: "Pipeline cancelled",
        description: "The pipeline has been stopped",
      });
      setShowCancelDialog(false);
    } catch (error) {
      toast({
        title: "Failed to cancel",
        description: "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async (runId: string) => {
    try {
      await approvePipeline.mutateAsync({
        pipelineId: selectedPipeline!,
        runId,
      });
      toast({
        title: "Pipeline approved",
        description: "Deployment will proceed",
      });
    } catch (error) {
      toast({
        title: "Failed to approve",
        description: "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleRollback = async (targetRunId: string) => {
    try {
      await rollbackPipeline.mutateAsync({
        pipelineId: selectedPipeline!,
        targetRunId,
      });
      toast({
        title: "Rollback initiated",
        description: "Rolling back to selected version",
      });
      setShowRollbackDialog(false);
    } catch (error) {
      toast({
        title: "Rollback failed",
        description: "An error occurred",
        variant: "destructive",
      });
    }
  };

  const filteredPipelines = pipelines?.filter((pipeline: PipelineRun) => {
    if (activeTab === "all") return true;
    if (activeTab === "running") return pipeline.status === "running";
    if (activeTab === "success") return pipeline.status === "success";
    if (activeTab === "failed") return pipeline.status === "failed";
    return true;
  });

  const runningCount =
    pipelines?.filter((p: PipelineRun) => p.status === "running").length || 0;
  const successCount =
    pipelines?.filter((p: PipelineRun) => p.status === "success").length || 0;
  const failedCount =
    pipelines?.filter((p: PipelineRun) => p.status === "failed").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Deployment Pipelines</h1>
          <p className="text-sm text-gray-400">
            CI/CD pipelines with real-time build logs and deployment control
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTriggerDialog(true)}
            className="border-gray-700 bg-[#1a1d24] text-white hover:bg-[#2a2e3a]"
          >
            <Play className="mr-2 h-4 w-4" />
            Trigger Manual
          </Button>
          <Button
            variant="outline"
            className="border-gray-700 bg-[#1a1d24] text-white hover:bg-[#2a2e3a]"
          >
            <Settings className="mr-2 h-4 w-4" />
            Pipeline Settings
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
              <p className="text-sm text-gray-400">Running</p>
              <p className="text-2xl font-bold text-white">{runningCount}</p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Successful</p>
              <p className="text-2xl font-bold text-white">{successCount}</p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Failed</p>
              <p className="text-2xl font-bold text-white">{failedCount}</p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
              <Timer className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Duration</p>
              <p className="text-2xl font-bold text-white">2m 34s</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-gray-800 bg-[#1a1d24]">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            All Runs
          </TabsTrigger>
          <TabsTrigger
            value="running"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Running
          </TabsTrigger>
          <TabsTrigger
            value="success"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Successful
          </TabsTrigger>
          <TabsTrigger
            value="failed"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Failed
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="border-gray-800 bg-[#1a1d24]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Service
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Branch / Commit
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Commit Message
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Triggered By
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Started
                    </th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPipelines ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        <RefreshCw className="mx-auto h-8 w-8 animate-spin" />
                      </td>
                    </tr>
                  ) : filteredPipelines?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        No pipeline runs found
                      </td>
                    </tr>
                  ) : (
                    filteredPipelines?.map((run: PipelineRun) => (
                      <tr
                        key={run.id}
                        className="border-b border-gray-800 hover:bg-[#1f232b]"
                      >
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`${
                              run.status === "running"
                                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                                : run.status === "success"
                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                : run.status === "failed"
                                ? "border-red-500/50 bg-red-500/10 text-red-400"
                                : run.status === "cancelled"
                                ? "border-gray-500/50 bg-gray-500/10 text-gray-400"
                                : "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            <span className="mr-1">
                              {getStatusIcon(run.status)}
                            </span>
                            {run.status.charAt(0).toUpperCase() +
                              run.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/20 text-xs text-blue-400">
                              {run.service.type.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-white">
                              {run.service.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm text-gray-300">
                              <GitBranch className="h-3 w-3" />
                              {run.branch}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <GitCommit className="h-3 w-3" />
                              {run.commit.slice(0, 7)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-xs truncate text-sm text-gray-300">
                            {run.commitMessage}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                            <div className="flex flex-col">
                              <span className="text-sm text-white">
                                {run.author}
                              </span>
                              <Badge
                                variant="outline"
                                className="w-fit border-gray-700 bg-transparent text-[10px] text-gray-500"
                              >
                                {run.triggerType}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {formatDuration(run.duration)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-400">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPipeline(run.pipelineId)}
                              className="text-gray-400 hover:text-white"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {run.status === "running" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  setShowCancelDialog(true);
                                }}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Square className="h-4 w-4" />
                              </Button>
                            )}
                            {run.status === "success" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRun(run);
                                  setShowRollbackDialog(true);
                                }}
                                className="text-orange-400 hover:text-orange-300"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="border-gray-800 bg-[#1a1d24]">
                                <DropdownMenuItem
                                  onClick={() => setSelectedPipeline(run.pipelineId)}
                                  className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white">
                                  <FileCode className="mr-2 h-4 w-4" />
                                  View Logs
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white">
                                  <GitMerge className="mr-2 h-4 w-4" />
                                  View in Git
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-800" />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedRun(run);
                                    setShowRollbackDialog(true);
                                  }}
                                  className="text-orange-400 focus:bg-[#2a2e3a] focus:text-orange-300"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Rollback
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedPipelineData && (
        <Card className="border-gray-800 bg-[#1a1d24] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPipeline(null)}
                className="text-gray-400"
              >
                <X className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Pipeline: {selectedPipelineData.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {selectedPipelineData.service.name} • Run #{selectedPipelineData.runs?.[0]?.id?.slice(-6)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedPipelineData.runs?.[0]?.status === "running" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRun(selectedPipelineData.runs[0]);
                    setShowCancelDialog(true);
                  }}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
              {selectedPipelineData.runs?.[0]?.status === "waiting" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleApprove(selectedPipelineData.runs[0].id)
                  }
                  className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRollbackDialog(true)}
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Rollback
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {selectedPipelineData.runs?.[0]?.stages?.map((stage: PipelineStage) => (
              <div
                key={stage.id}
                className="rounded-lg border border-gray-800 bg-[#14161c]"
              >
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-[#1a1d24]"
                  onClick={() =>
                    setExpandedStage(expandedStage === stage.id ? null : stage.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${getStatusColor(
                        stage.status
                      )}`}
                    >
                      {getStatusIcon(stage.status)}
                    </div>
                    <span className="font-medium text-white">{stage.name}</span>
                    <Badge
                      variant="outline"
                      className="border-gray-700 bg-transparent text-gray-400"
                    >
                      {formatDuration(stage.duration)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {stage.logs?.length || 0} log lines
                    </span>
                    {expandedStage === stage.id ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedStage === stage.id && (
                  <div className="border-t border-gray-800 bg-[#0d0f12]">
                    <div className="p-4 font-mono text-sm">
                      {isLoadingLogs ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                      ) : pipelineLogs?.[stage.id]?.length > 0 ? (
                        <div className="max-h-96 space-y-1 overflow-y-auto">
                          {pipelineLogs[stage.id].map((log: string, i: number) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-gray-600">
                                [{new Date().toISOString().split("T")[1].slice(0, 8)}]
                              </span>
                              <span
                                className={
                                  log.includes("ERROR")
                                    ? "text-red-400"
                                    : log.includes("WARN")
                                    ? "text-yellow-400"
                                    : log.includes("SUCCESS")
                                    ? "text-green-400"
                                    : "text-gray-300"
                                }
                              >
                                {log}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No logs available yet...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={showTriggerDialog} onOpenChange={setShowTriggerDialog}>
        <DialogContent className="border-gray-800 bg-[#1a1d24] text-white">
          <DialogHeader>
            <DialogTitle>Trigger Manual Pipeline</DialogTitle>
            <DialogDescription className="text-gray-400">
              Manually start a deployment pipeline for a specific branch
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Repository
              </label>
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger className="border-gray-700 bg-[#14161c] text-white">
                  <SelectValue placeholder="Select repository" />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-[#1a1d24]">
                  {repositories?.map((repo: any) => (
                    <SelectItem
                      key={repo.id}
                      value={repo.id}
                      className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                    >
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-gray-300">Branch</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="border-gray-700 bg-[#14161c] text-white">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent className="border-gray-800 bg-[#1a1d24]">
                  {branches?.map((branch: string) => (
                    <SelectItem
                      key={branch}
                      value={branch}
                      className="text-gray-300 focus:bg-[#2a2e3a] focus:text-white"
                    >
                      {branch}
                    </SelectItem>
                  )) || (
                    <SelectItem value="main" className="text-gray-300">
                      main
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Commit Hash (optional)
              </label>
              <input
                type="text"
                value={manualCommit}
                onChange={(e) => setManualCommit(e.target.value)}
                placeholder="Leave empty for latest commit"
                className="w-full rounded-md border border-gray-700 bg-[#14161c] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowTriggerDialog(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTrigger}
              disabled={!selectedRepo || triggerPipeline.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {triggerPipeline.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="border-gray-800 bg-[#1a1d24] text-white">
          <DialogHeader>
            <DialogTitle>Cancel Pipeline</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to cancel this running pipeline?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="mb-2 block text-sm text-gray-300">
              Reason for cancellation (optional)
            </label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Found critical bug, need to update config..."
              className="border-gray-700 bg-[#14161c] text-white placeholder-gray-500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCancelDialog(false)}
              className="text-gray-400 hover:text-white"
            >
              Keep Running
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelPipeline.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancelPipeline.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              Cancel Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent className="max-w-2xl border-gray-800 bg-[#1a1d24] text-white">
          <DialogHeader>
            <DialogTitle>Rollback to Previous Version</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select a previous successful deployment to rollback to
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {selectedPipelineData?.runs
                ?.filter((r: PipelineRun) => r.status === "success")
                .slice(0, 10)
                .map((run: PipelineRun) => (
                  <div
                    key={run.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-800 bg-[#14161c] p-3 hover:border-gray-700"
                    onClick={() => handleRollback(run.id)}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          Run #{run.id.slice(-6)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {run.commit.slice(0, 7)} • {run.commitMessage}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {new Date(run.completedAt || run.startedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDuration(run.duration)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowRollbackDialog(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
