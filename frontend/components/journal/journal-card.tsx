"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Star,
  Trash2,
  Clock,
  Link as LinkIcon,
} from "lucide-react";
import type { JournalEntry } from "@/types/journal";
import { EMOTIONAL_STATES } from "@/types/journal";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface JournalCardProps {
  entry: JournalEntry;
  onDelete?: (id: string) => void;
}

export function JournalCard({ entry, onDelete }: JournalCardProps) {
  const emotionConfig = EMOTIONAL_STATES.find(
    (s) => s.value === entry.emotional_state
  );
  const trade = entry.trade;

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {entry.title && (
              <h3 className="font-semibold text-sm leading-tight mb-1">
                {entry.title}
              </h3>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Emotional state */}
              {emotionConfig && (
                <Badge
                  variant="outline"
                  className={`text-[10px] py-0.5 ${emotionConfig.color}`}
                >
                  <span className="mr-0.5">{emotionConfig.emoji}</span>
                  {emotionConfig.label}
                </Badge>
              )}

              {/* Rating */}
              {entry.rating && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < entry.rating!
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Delete button */}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-loss"
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Linked Trade */}
        {trade && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2.5 mb-3">
            <LinkIcon className="h-3 w-3 text-muted-foreground" />
            <Badge
              variant="outline"
              className={`text-[10px] ${
                trade.direction === "long"
                  ? "text-profit border-profit/20"
                  : "text-loss border-loss/20"
              }`}
            >
              {trade.direction === "long" ? (
                <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
              )}
              {trade.direction.toUpperCase()}
            </Badge>
            <span className="text-sm font-semibold">{trade.symbol}</span>
            {trade.status === "closed" && (
              <span
                className={`text-xs font-mono font-semibold ${
                  trade.pnl_amount >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {trade.pnl_amount >= 0 ? "+" : ""}$
                {trade.pnl_amount.toFixed(2)}
              </span>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] ml-auto ${
                trade.status === "open"
                  ? "text-primary border-primary/20"
                  : trade.status === "closed"
                  ? "text-muted-foreground"
                  : ""
              }`}
            >
              {trade.status}
            </Badge>
          </div>
        )}

        {/* Content */}
        {entry.content && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">
            {entry.content}
          </p>
        )}

        {/* Mistake Tags */}
        {entry.mistake_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {entry.mistake_tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] py-0 text-loss/70 border-loss/15 bg-loss/5"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            <span>Journal Entry</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(entry.created_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
