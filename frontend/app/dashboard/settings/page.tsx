"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  Send,
  Bell,
  Zap,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  ExternalLink,
  User,
  Mail,
  Trash2,
  Database,
  Save,
  Shield,
} from "lucide-react";
import { useAlerts, useAlertActions } from "@/hooks/use-alerts";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { Alert } from "@/types/alert";

const EVENT_TYPES = [
  {
    key: "new_signal" as const,
    label: "New Signal",
    description: "Get notified when a new trading signal is detected",
    icon: Zap,
    color: "text-amber-400",
  },
  {
    key: "trade_closed" as const,
    label: "Trade Closed",
    description: "Get notified when a trade is closed",
    icon: TrendingUp,
    color: "text-emerald-400",
  },
  {
    key: "journal_reminder" as const,
    label: "Journal Reminder",
    description: "Daily reminder to journal your trades",
    icon: BookOpen,
    color: "text-blue-400",
  },
];

export default function SettingsPage() {
  const { data, isLoading } = useAlerts();
  const { createAlert, updateAlert, deleteAlert, testTelegram } = useAlertActions();

  const [chatId, setChatId] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [savingChatId, setSavingChatId] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Data management state
  const [retentionDays, setRetentionDays] = useState("7");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  // Extract alerts by event type
  const alerts = data?.alerts ?? [];

  const getAlert = useCallback(
    (eventType: string): Alert | undefined =>
      alerts.find((a) => a.channel === "telegram" && a.event_type === eventType),
    [alerts]
  );

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email || "");
          setDisplayName(user.user_metadata?.display_name || "");
        }
      } catch {
        // Ignore errors
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  // Initialize chat ID from existing alerts
  useEffect(() => {
    if (alerts.length > 0) {
      const telegramAlert = alerts.find((a) => a.channel === "telegram");
      if (telegramAlert?.config) {
        const existingChatId = (telegramAlert.config as Record<string, string>).chat_id;
        if (existingChatId && !chatId) {
          setChatId(existingChatId);
        }
      }
    }
  }, [alerts, chatId]);

  // Save profile
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });

      if (error) throw error;
      setProfileMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err: any) {
      setProfileMessage({
        type: "error",
        text: err.message || "Failed to update profile",
      });
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMessage(null), 4000);
    }
  };

  // Test Telegram connection
  const handleTestConnection = async () => {
    if (!chatId.trim()) return;

    setTestStatus("loading");
    setTestMessage("");

    try {
      const result = await testTelegram.mutateAsync(chatId.trim());
      setTestStatus("success");
      setTestMessage(result.message);
    } catch (err: unknown) {
      setTestStatus("error");
      setTestMessage(
        err instanceof Error ? err.message : "Failed to send test message"
      );
    }

    // Reset status after 5 seconds
    setTimeout(() => setTestStatus("idle"), 5000);
  };

  // Toggle an event type on/off
  const handleToggle = async (eventType: string, enabled: boolean) => {
    const existing = getAlert(eventType);

    if (enabled && !existing) {
      // Create new alert
      await createAlert.mutateAsync({
        channel: "telegram",
        event_type: eventType,
        config: { chat_id: chatId.trim() },
        is_active: true,
      });
    } else if (enabled && existing && !existing.is_active) {
      // Re-enable
      await updateAlert.mutateAsync({
        id: existing.id,
        is_active: true,
      });
    } else if (!enabled && existing) {
      // Disable (soft)
      await updateAlert.mutateAsync({
        id: existing.id,
        is_active: false,
      });
    }
  };

  // Save chat ID across all existing alerts
  const handleSaveChatId = async () => {
    if (!chatId.trim()) return;
    setSavingChatId(true);

    try {
      for (const alert of alerts) {
        if (alert.channel === "telegram") {
          await updateAlert.mutateAsync({
            id: alert.id,
            config: { ...alert.config, chat_id: chatId.trim() },
          });
        }
      }
    } catch {
      // Errors handled by mutation
    }

    setSavingChatId(false);
  };

  // Signal cleanup
  const handleSignalCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);

    try {
      const result = await api.delete<{ deleted_count: number }>(
        `/signals?older_than_days=${retentionDays}`
      );
      setCleanupResult(`Cleaned up ${result.deleted_count} signal(s) older than ${retentionDays} days`);
    } catch (err: any) {
      setCleanupResult(`Error: ${err.message}`);
    } finally {
      setCleanupLoading(false);
      setTimeout(() => setCleanupResult(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your notification preferences and platform settings
        </p>
      </div>

      {/* Profile Section */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <User className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>
                Your account information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileLoading ? (
            <div className="space-y-3">
              <div className="h-10 w-full bg-muted/30 rounded-md animate-pulse" />
              <div className="h-10 w-full bg-muted/30 rounded-md animate-pulse" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="Your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-accent/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </span>
                </Label>
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="bg-accent/20 text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed from here
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="gap-2"
                >
                  {profileSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Profile
                </Button>

                {profileMessage && (
                  <span
                    className={`flex items-center gap-1.5 text-sm animate-in fade-in slide-in-from-left-2 duration-200 ${
                      profileMessage.type === "success"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {profileMessage.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {profileMessage.text}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Telegram Configuration */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Send className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Telegram Notifications</CardTitle>
              <CardDescription>
                Receive trading signals directly in Telegram
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Setup instructions */}
          <div className="rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground/80">Quick Setup:</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>
                Open{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                >
                  @BotFather <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and create a bot (or use an existing one)
              </li>
              <li>Set the bot token in your backend <code className="bg-accent px-1 rounded">.env</code> file</li>
              <li>
                Get your Chat ID from{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                >
                  @userinfobot <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Paste your Chat ID below and test the connection</li>
            </ol>
          </div>

          {/* Chat ID Input */}
          <div className="space-y-2">
            <Label htmlFor="telegram-chat-id">Telegram Chat ID</Label>
            <div className="flex gap-2">
              <Input
                id="telegram-chat-id"
                placeholder="e.g. 123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="bg-accent/30 font-mono"
              />
              {alerts.some((a) => a.channel === "telegram") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveChatId}
                  disabled={savingChatId || !chatId.trim()}
                  className="shrink-0"
                >
                  {savingChatId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!chatId.trim() || testStatus === "loading"}
              className="gap-2"
            >
              {testStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Test Connection
            </Button>

            {testStatus === "success" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400 animate-in fade-in slide-in-from-left-2 duration-200">
                <CheckCircle2 className="h-4 w-4" />
                {testMessage}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1.5 text-sm text-red-400 animate-in fade-in slide-in-from-left-2 duration-200">
                <XCircle className="h-4 w-4" />
                {testMessage}
              </span>
            )}
          </div>

          <Separator />

          {/* Event Type Toggles */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Notification Events</Label>
            <p className="text-xs text-muted-foreground">
              Choose which events trigger a Telegram notification
            </p>
          </div>

          <div className="space-y-3">
            {EVENT_TYPES.map((eventType) => {
              const alert = getAlert(eventType.key);
              const isEnabled = alert?.is_active ?? false;
              const isMutating =
                createAlert.isPending || updateAlert.isPending;

              return (
                <div
                  key={eventType.key}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-accent/20 p-3.5 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-accent/50`}
                    >
                      <eventType.icon
                        className={`h-4 w-4 ${eventType.color}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{eventType.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {eventType.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      handleToggle(eventType.key, checked)
                    }
                    disabled={isMutating || !chatId.trim()}
                  />
                </div>
              );
            })}
          </div>

          {!chatId.trim() && (
            <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Enter your Chat ID above to enable notification toggles
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Database className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base">Data Management</CardTitle>
              <CardDescription>
                Manage signal data retention and cleanup
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80 mb-1">Signal Cleanup</p>
            <p>
              Remove old signals to keep your feed relevant and improve
              performance. This action is irreversible.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="retention-days">Retention Period</Label>
              <Select value={retentionDays} onValueChange={setRetentionDays}>
                <SelectTrigger className="bg-accent/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignalCleanup}
                disabled={cleanupLoading}
                className="gap-2 text-loss hover:text-loss hover:bg-loss/10 border-loss/30"
              >
                {cleanupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clean Up Now
              </Button>
            </div>
          </div>

          {cleanupResult && (
            <div
              className={`rounded-lg px-4 py-2.5 text-sm animate-in fade-in duration-200 ${
                cleanupResult.startsWith("Error")
                  ? "bg-loss/10 border border-loss/20 text-loss"
                  : "bg-profit/10 border border-profit/20 text-profit"
              }`}
            >
              {cleanupResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">General</CardTitle>
              <CardDescription>
                Display and scanning preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Timeframe</Label>
            <Select defaultValue="1h">
              <SelectTrigger className="bg-accent/30 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">15 minutes</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="4h">4 hours</SelectItem>
                <SelectItem value="1d">1 day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
