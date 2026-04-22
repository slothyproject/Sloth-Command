"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Switch } from "@/app/components/ui/switch";
import { useToast } from "@/app/components/ui/use-toast";
import {
  Bell,
  Mail,
  MessageSquare,
  Slack,
  Webhook,
  Send,
  CheckCircle,
  AlertTriangle,
  Info,
  Save,
  TestTube,
  Plus,
  Trash2,
  Edit3,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface NotificationChannel {
  id: string;
  type: "discord" | "email" | "slack" | "webhook";
  name: string;
  enabled: boolean;
  config: Record<string, string>;
  events: string[];
  lastTest?: string;
  testStatus?: "success" | "failed";
}

const eventTypes = [
  { value: "deployment_started", label: "Deployment Started", category: "deployments" },
  { value: "deployment_success", label: "Deployment Successful", category: "deployments" },
  { value: "deployment_failed", label: "Deployment Failed", category: "deployments" },
  { value: "service_crashed", label: "Service Crashed", category: "services" },
  { value: "service_restarted", label: "Service Restarted", category: "services" },
  { value: "high_cpu", label: "High CPU Usage", category: "metrics" },
  { value: "high_memory", label: "High Memory Usage", category: "metrics" },
  { value: "scaling_triggered", label: "Auto-Scaling Triggered", category: "automation" },
  { value: "healing_triggered", label: "Auto-Healing Triggered", category: "automation" },
  { value: "backup_success", label: "Backup Successful", category: "backups" },
  { value: "backup_failed", label: "Backup Failed", category: "backups" },
  { value: "security_alert", label: "Security Alert", category: "security" },
];

export default function NotificationsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("channels");
  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      id: "1",
      type: "discord",
      name: "Discord Alerts",
      enabled: true,
      config: { webhookUrl: "https://discord.com/api/webhooks/..." },
      events: ["deployment_started", "deployment_failed", "service_crashed"],
      lastTest: "2024-01-25T10:00:00Z",
      testStatus: "success",
    },
    {
      id: "2",
      type: "email",
      name: "Email Notifications",
      enabled: true,
      config: { smtpHost: "smtp.gmail.com", smtpPort: "587", from: "alerts@centralhub.io" },
      events: ["deployment_failed", "service_crashed", "security_alert"],
    },
  ]);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const handleTestChannel = (channelId: string) => {
    toast({
      title: "Test notification sent",
      description: "Check your channel for the test message",
    });
  };

  const handleToggleChannel = (channelId: string, enabled: boolean) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, enabled } : c))
    );
    toast({
      title: enabled ? "Channel enabled" : "Channel disabled",
      description: `Notification channel has been ${enabled ? "enabled" : "disabled"}`,
    });
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "discord":
        return <MessageSquare className="h-5 w-5 text-indigo-400" />;
      case "email":
        return <Mail className="h-5 w-5 text-blue-400" />;
      case "slack":
        return <Slack className="h-5 w-5 text-green-400" />;
      case "webhook":
        return <Webhook className="h-5 w-5 text-orange-400" />;
      default:
        return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  const getEventCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      deployments: "bg-blue-500/20 text-blue-400",
      services: "bg-purple-500/20 text-purple-400",
      metrics: "bg-yellow-500/20 text-yellow-400",
      automation: "bg-green-500/20 text-green-400",
      backups: "bg-cyan-500/20 text-cyan-400",
      security: "bg-red-500/20 text-red-400",
    };
    return colors[category] || "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-gray-400">
            Configure notification channels for deployment events, alerts, and system events
          </p>
        </div>
        <Button className="bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <Bell className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Channels</p>
              <p className="text-2xl font-bold text-white">
                {channels.filter((c) => c.enabled).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
              <Send className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Notifications Sent (24h)</p>
              <p className="text-2xl font-bold text-white">47</p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Alert Rate</p>
              <p className="text-2xl font-bold text-white">12/h</p>
            </div>
          </div>
        </Card>

        <Card className="border-gray-800 bg-[#1a1d24] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
              <CheckCircle className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Delivery Rate</p>
              <p className="text-2xl font-bold text-white">99.2%</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border-gray-800 bg-[#1a1d24]">
          <TabsTrigger
            value="channels"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Channels
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            Event Types
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-white"
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-4 space-y-4">
          {channels.map((channel) => (
            <Card key={channel.id} className="border-gray-800 bg-[#1a1d24]">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-[#14161c]">
                      {getChannelIcon(channel.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{channel.name}</h3>
                        <Badge
                          variant="outline"
                          className={`${
                            channel.enabled
                              ? "border-green-500/50 bg-green-500/10 text-green-400"
                              : "border-gray-500/50 bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {channel.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-400 capitalize">
                        {channel.type} • {channel.events.length} events configured
                      </p>
                      {channel.lastTest && (
                        <p className="mt-1 text-xs text-gray-500">
                          Last tested: {new Date(channel.lastTest).toLocaleString()}
                          {channel.testStatus === "success" ? (
                            <span className="ml-2 text-green-400">✓ Working</span>
                          ) : (
                            <span className="ml-2 text-red-400">✗ Failed</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(checked) => handleToggleChannel(channel.id, checked)}
                      className="data-[state=checked]:bg-green-600"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestChannel(channel.id)}
                      className="text-gray-400 hover:text-white"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedChannel(expandedChannel === channel.id ? null : channel.id)}
                      className="text-gray-400"
                    >
                      {expandedChannel === channel.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedChannel === channel.id && (
                  <div className="mt-4 border-t border-gray-800 pt-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-white">Configuration</h4>
                        <div className="rounded-lg border border-gray-800 bg-[#14161c] p-3">
                          {Object.entries(channel.config).map(([key, value]) => (
                            <div key={key} className="flex justify-between py-1">
                              <span className="text-sm text-gray-400">{key}:</span>
                              <span className="text-sm text-gray-300 font-mono">
                                {key.includes("url") || key.includes("pass") || key.includes("token")
                                  ? "••••••••••••"
                                  : value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-2 text-sm font-medium text-white">Subscribed Events</h4>
                        <div className="flex flex-wrap gap-2">
                          {channel.events.map((eventValue) => {
                            const event = eventTypes.find((e) => e.value === eventValue);
                            return event ? (
                              <Badge
                                key={eventValue}
                                variant="outline"
                                className={getEventCategoryColor(event.category)}
                              >
                                {event.label}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="border-gray-700">
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="border-red-500/50 text-red-400">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card className="border-gray-800 bg-[#1a1d24] p-6">
            <div className="space-y-6">
              {["deployments", "services", "metrics", "automation", "backups", "security"].map(
                (category) => (
                  <div key={category}>
                    <h3 className="mb-3 text-lg font-medium text-white capitalize">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {eventTypes
                        .filter((e) => e.category === category)
                        .map((event) => (
                          <div
                            key={event.value}
                            className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#14161c] p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={channels.some((c) => c.events.includes(event.value))}
                                className="data-[state=checked]:bg-blue-600"
                              />
                              <span className="text-sm text-gray-300">{event.label}</span>
                            </div>
                            <Badge variant="outline" className={getEventCategoryColor(category)}>
                              {category}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-gray-800 bg-[#1a1d24] p-6">
            <div className="text-center text-gray-400">
              <Bell className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">Notification history will appear here</p>
              <p className="text-sm">Track all sent notifications and their delivery status</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
