"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ImagePlus, X, Loader2, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReplyInfo {
  id: string;
  authorName: string;
  content: string | null;
}

interface ChatInputProps {
  placeholder?: string;
  maxLength?: number;
  onSend: (message: string | null, imageUrl: string | null, replyToId?: string) => Promise<void>;
  getUploadUrl: (filename: string, contentType: string) => Promise<{
    upload_url: string;
    file_url: string;
    expires_in: number;
  }>;
  disabled?: boolean;
  className?: string;
  replyTo?: ReplyInfo | null;
  onCancelReply?: () => void;
}

export function ChatInput({
  placeholder = "Type a message...",
  maxLength = 500,
  onSend,
  getUploadUrl,
  disabled = false,
  className,
  replyTo,
  onCancelReply,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processImageFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPG, PNG, GIF, or WebP image",
        variant: "destructive",
      });
      return false;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return false;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    return true;
  }, [toast]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Create a named file for clipboard images
          const namedFile = new File(
            [file],
            `clipboard-${Date.now()}.png`,
            { type: file.type }
          );
          processImageFile(namedFile);
        }
        break;
      }
    }
  }, [processImageFile]);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !imageFile) || isSending || disabled) return;

    setIsSending(true);
    let imageUrl: string | null = null;

    try {
      // Upload image first if present
      if (imageFile) {
        setIsUploading(true);
        const { upload_url, file_url } = await getUploadUrl(
          imageFile.name,
          imageFile.type
        );

        // Upload to S3
        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          body: imageFile,
          headers: {
            "Content-Type": imageFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }

        imageUrl = file_url;
        setIsUploading(false);
      }

      // Send message with reply
      await onSend(message.trim() || null, imageUrl, replyTo?.id);

      // Reset state
      setMessage("");
      removeImage();
      onCancelReply?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isSending || isUploading;
  const canSend = (message.trim() || imageFile) && !isDisabled;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg"
          >
            <div className="w-1 h-8 bg-primary rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-medium">Replying to {replyTo.authorName}</p>
              <p className="text-xs text-gray-500 truncate">
                {replyTo.content || "Photo"}
              </p>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview */}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative inline-block"
          >
            <div className="relative rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-32 max-w-[200px] object-contain"
              />
              <button
                onClick={removeImage}
                disabled={isDisabled}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Row */}
      <div className="flex gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageSelect}
          className="hidden"
          disabled={isDisabled}
        />

        {/* Image button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="flex-shrink-0 text-gray-500 hover:text-gray-900"
        >
          <ImagePlus className="w-5 h-5" />
        </Button>

        {/* Text input */}
        <Input
          placeholder={imageFile ? "Add a caption..." : placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isDisabled}
          className="flex-1 bg-white border-gray-100"
        />

        {/* Send button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "flex-shrink-0 transition-all",
            canSend
              ? "bg-primary hover:bg-york-red-dark text-white"
              : "bg-gray-100 text-gray-400"
          )}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Character count */}
      {maxLength && (
        <p className="text-xs text-gray-500 text-right">
          {message.length}/{maxLength}
        </p>
      )}
    </div>
  );
}
