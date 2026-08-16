"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, Star, X } from "lucide-react";
import type { JournalCreate, EmotionalState } from "@/types/journal";
import { EMOTIONAL_STATES, COMMON_MISTAKE_TAGS } from "@/types/journal";
import type { Trade } from "@/types/trade";

interface JournalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: JournalCreate) => Promise<void>;
  loading?: boolean;
  trades?: Trade[];
  preselectedTradeId?: string;
}

export function JournalFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  trades = [],
  preselectedTradeId,
}: JournalFormDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tradeId, setTradeId] = useState(preselectedTradeId || "");
  const [emotionalState, setEmotionalState] = useState<EmotionalState | "">("");
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const entry: JournalCreate = {
      title: title || undefined,
      content: content || undefined,
      trade_id: tradeId || undefined,
      emotional_state: emotionalState || undefined,
      rating: rating > 0 ? rating : undefined,
      mistake_tags: selectedTags.length > 0 ? selectedTags : undefined,
    };

    await onSubmit(entry);

    // Reset form
    setTitle("");
    setContent("");
    setTradeId("");
    setEmotionalState("");
    setRating(0);
    setSelectedTags([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            New Journal Entry
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="j-title">Title</Label>
            <Input
              id="j-title"
              placeholder="e.g. BTC breakout analysis..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/30"
            />
          </div>

          {/* Link to Trade */}
          <div className="space-y-2">
            <Label>Link to Trade (optional)</Label>
            <Select value={tradeId} onValueChange={(v) => setTradeId(v ?? "")}>
              <SelectTrigger className="bg-muted/30">
                <SelectValue placeholder="Select a trade..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No trade</SelectItem>
                {trades.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          t.direction === "long" ? "text-profit" : "text-loss"
                        }
                      >
                        {t.direction.toUpperCase()}
                      </span>
                      <span className="font-semibold">{t.symbol}</span>
                      <span className="text-muted-foreground">
                        {t.status === "closed"
                          ? `${t.pnl_amount >= 0 ? "+" : ""}$${t.pnl_amount.toFixed(2)}`
                          : "open"}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Emotional State */}
          <div className="space-y-2">
            <Label>Emotional State</Label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONAL_STATES.map((state) => (
                <Badge
                  key={state.value}
                  variant={
                    emotionalState === state.value ? "default" : "outline"
                  }
                  className={`cursor-pointer transition-all text-xs py-1 px-2.5 ${
                    emotionalState === state.value
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() =>
                    setEmotionalState(
                      emotionalState === state.value ? "" : state.value
                    )
                  }
                >
                  <span className="mr-1">{state.emoji}</span>
                  {state.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Content / Notes */}
          <div className="space-y-2">
            <Label htmlFor="j-content">Notes</Label>
            <Textarea
              id="j-content"
              placeholder="What happened? What did you learn? What would you do differently?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="bg-muted/30 resize-none"
            />
          </div>

          {/* Mistake Tags */}
          <div className="space-y-2">
            <Label>Mistake Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_MISTAKE_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className={`cursor-pointer transition-all text-[10px] py-0.5 px-2 ${
                    selectedTags.includes(tag)
                      ? "bg-loss/20 text-loss border-loss/30"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            {/* Custom tag input */}
            <div className="flex items-center gap-2 mt-2">
              <Input
                placeholder="Custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                className="bg-muted/30 h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={addCustomTag}
                disabled={!customTag.trim()}
              >
                Add
              </Button>
            </div>
            {/* Selected tags display */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-md bg-muted/20">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] py-0.5 pr-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="ml-1 hover:text-loss"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Trade Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? 0 : star)}
                  className="p-0.5 transition-colors"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  {rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4 mr-2" />
              )}
              Save Entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
