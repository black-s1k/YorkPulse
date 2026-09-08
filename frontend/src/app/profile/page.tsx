"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  GraduationCap,
  Edit,
  Save,
  X,
  Loader2,
  Shield,
  ShoppingBag,
  Users,
  Camera,
  Upload,
  ImagePlus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CameraModal } from "@/components/ui/camera-modal";
import { useUser, useUpdateProfile } from "@/hooks/useAuth";
import { useMyListings } from "@/hooks/useMarketplace";
import { useMyBuddyRequests, useMyParticipation } from "@/hooks/useBuddy";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import FounderBadge from "@/components/FounderBadge";

// Program suggestions from York University courses
const PROGRAM_SUGGESTIONS = [
  "Accounting",
  "Biology",
  "Business Administration",
  "Chemistry",
  "Civil Engineering",
  "Commerce",
  "Computer Engineering",
  "Computer Science",
  "Computer Science for Software Development",
  "Dance",
  "Digital Arts",
  "Digital Technologies",
  "Earth and Space Science Engineering",
  "Economics",
  "Education",
  "English",
  "Finance",
  "Geomatics Engineering",
  "Health Science",
  "Health Studies",
  "History",
  "Humanities",
  "Information Systems",
  "Information Technology",
  "Kinesiology",
  "Management",
  "Marketing",
  "Mathematics",
  "Mechanical Engineering",
  "Music",
  "Nursing",
  "Operations Management",
  "Philosophy",
  "Physics",
  "Political Science",
  "Psychology",
  "Sociology",
  "Software Engineering",
  "Statistics",
  "Theatre",
  "Visual Arts",
];

// Capitalize first letter of each word
const capitalizeWords = (str: string) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const { isLoading, refetch } = useUser();
  const updateProfileMutation = useUpdateProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [program, setProgram] = useState(user?.program || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests?.join(", ") || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  // All hooks must be called before conditional returns (Rules of Hooks)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: listingsData } = useMyListings(isAuthenticated);
  const { data: questsData } = useMyBuddyRequests(undefined, isAuthenticated);

  // Validation constants
  const MIN_PROGRAM_LENGTH = 3;
  const MIN_BIO_LENGTH = 20;

  // Validation state
  const programError = program.trim().length > 0 && program.trim().length < MIN_PROGRAM_LENGTH
    ? `Program must be at least ${MIN_PROGRAM_LENGTH} characters`
    : !program.trim() ? "Program is required" : "";
  const bioError = bio.trim().length > 0 && bio.trim().length < MIN_BIO_LENGTH
    ? `Bio must be at least ${MIN_BIO_LENGTH} characters`
    : !bio.trim() ? "Bio is required" : "";
  const isFormValid = program.trim().length >= MIN_PROGRAM_LENGTH && bio.trim().length >= MIN_BIO_LENGTH;

  // Auth guard - MUST be after all hooks
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Profile</h1>
            <p className="text-sm text-gray-400">Your account</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to view your profile</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Manage your account and view your activity on YorkPulse.
          </p>
          <Link href="/auth/login">
            <Button className="bg-primary hover:bg-york-red-dark">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const listings = listingsData?.pages.flatMap((p) => p.items) || [];
  const quests = questsData?.pages.flatMap((p) => p.items) || [];

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        name: name.trim() || undefined,
        program: program || undefined,
        bio: bio || undefined,
        interests: interests
          ? interests.split(",").map((i) => i.trim()).filter(Boolean)
          : undefined,
      });
      toast({ title: "Profile updated" });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Get presigned URL
      const { upload_url, file_url } = await api.auth.getAvatarUploadUrl(
        file.name,
        file.type
      );

      // Upload to S3
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Update profile with new avatar URL
      await updateProfileMutation.mutateAsync({
        avatar_url: file_url,
      });

      // Refresh user data
      await refetch();

      toast({ title: "Profile picture updated" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle camera capture (receives File directly from camera modal)
  const handleCameraCapture = async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      // Get presigned URL
      const { upload_url, file_url } = await api.auth.getAvatarUploadUrl(
        file.name,
        file.type
      );

      // Upload to storage
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Update profile with new avatar URL
      await updateProfileMutation.mutateAsync({
        avatar_url: file_url,
      });

      // Refresh user data
      await refetch();

      toast({ title: "Profile picture updated" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsRemovingAvatar(true);
    try {
      await updateProfileMutation.mutateAsync({ avatar_url: null });
      await refetch();
      toast({ title: "Profile picture removed" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove profile picture",
        variant: "destructive",
      });
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 text-center">
        <User className="w-12 h-12 mx-auto text-gray-700 mb-4" />
        <p className="text-gray-400">Sign in to view your profile</p>
        <Button variant="link" asChild className="text-primary">
          <Link href="/auth/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div>
            <Skeleton className="w-40 h-6 mb-2" />
            <Skeleton className="w-60 h-4" />
          </div>
        </div>
        <Skeleton className="w-full h-48" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white border border-gray-100 shadow-sm mb-6"
      >
        <div className="flex items-start gap-4">
          <div className="relative group">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?"}
              </AvatarFallback>
            </Avatar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={isUploadingAvatar}>
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-white" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setIsCameraOpen(true)}>
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </DropdownMenuItem>
                {user?.avatar_url && (
                  <DropdownMenuItem
                    onClick={handleRemoveAvatar}
                    disabled={isRemovingAvatar}
                    className="text-red-700 focus:text-red-700"
                  >
                    {isRemovingAvatar ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Remove Photo
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* File upload input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            {/* Camera modal */}
            <CameraModal
              open={isCameraOpen}
              onClose={() => setIsCameraOpen(false)}
              onCapture={handleCameraCapture}
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl font-bold">{user?.name}</h1>
              {user?.name_verified && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
              {user?.is_founder && (
                <span title="Founder — Early member of YorkPulse">
                  <FounderBadge />
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Mail className="w-4 h-4" />
              {user?.email}
            </div>

            {user?.program && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <GraduationCap className="w-4 h-4" />
                {user.program}
              </div>
            )}
          </div>

          <Button
            variant={isEditing ? "ghost" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </Button>
        </div>

        {/* Bio & Interests */}
        {isEditing ? (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(capitalizeWords(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program">
                Program <span className="text-red-700">*</span>
              </Label>
              <Input
                id="program"
                list="program-suggestions"
                placeholder="e.g., Computer Science"
                value={program}
                onChange={(e) => setProgram(capitalizeWords(e.target.value))}
                className={cn(programError && program.length > 0 && "border-red-500 focus-visible:ring-red-500")}
              />
              <datalist id="program-suggestions">
                {PROGRAM_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <div className="flex justify-between text-xs">
                <span className={cn(programError && program.length > 0 ? "text-red-700" : "text-gray-400")}>
                  {programError && program.length > 0 ? programError : `Min ${MIN_PROGRAM_LENGTH} characters`}
                </span>
                <span className="text-gray-400">{program.trim().length} chars</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">
                Bio <span className="text-red-700">*</span>
              </Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={cn("min-h-[100px]", bioError && bio.length > 0 && "border-red-500 focus-visible:ring-red-500")}
              />
              <div className="flex justify-between text-xs">
                <span className={cn(bioError && bio.length > 0 ? "text-red-700" : "text-gray-400")}>
                  {bioError && bio.length > 0 ? bioError : `Min ${MIN_BIO_LENGTH} characters`}
                </span>
                <span className="text-gray-400">{bio.trim().length} chars</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interests">Interests (comma separated)</Label>
              <Input
                id="interests"
                placeholder="e.g., coding, music, hiking"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-primary hover:bg-york-red-dark"
                disabled={updateProfileMutation.isPending || !isFormValid}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {user?.bio && <p className="text-gray-700 mb-3 whitespace-pre-wrap">{user.bio}</p>}
            {user?.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
          <ShoppingBag className="w-5 h-5 mx-auto mb-2 text-coral-400" />
          <p className="text-2xl font-bold">{listings.length}</p>
          <p className="text-xs text-gray-400">Listings</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
          <Users className="w-5 h-5 mx-auto mb-2 text-green-700" />
          <p className="text-2xl font-bold">{quests.length}</p>
          <p className="text-xs text-gray-400">Quests</p>
        </div>
      </div>

      {/* Activity Tabs */}
      <Tabs defaultValue="listings">
        <TabsList className="w-full">
          <TabsTrigger value="listings" className="flex-1">
            Listings
          </TabsTrigger>
          <TabsTrigger value="quests" className="flex-1">
            Quests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4 space-y-3">
          {listings.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No listings yet</p>
          ) : (
            listings.slice(0, 5).map((listing) => (
              <Link key={listing.id} href={`/marketplace/${listing.id}`}>
                <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt=""
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-gray-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{listing.title}</p>
                      <p className="text-sm text-coral-400">${Number(listing.price).toFixed(2)}</p>
                    </div>
                    <Badge variant="secondary">{listing.status}</Badge>
                  </div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="quests" className="mt-4 space-y-3">
          {quests.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No quests yet</p>
          ) : (
            quests.slice(0, 5).map((quest) => (
              <Link key={quest.id} href={`/quests/${quest.id}`}>
                <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{quest.activity}</p>
                      <p className="text-sm text-gray-400">
                        {quest.current_participants}/{quest.max_participants} participants
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        quest.status === "open" && "bg-green-500/20 text-green-700"
                      )}
                    >
                      {quest.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
