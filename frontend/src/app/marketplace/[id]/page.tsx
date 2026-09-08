"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  Star,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Check,
  Pencil,
  X,
  Save,
  Loader2,
  ImagePlus,
  Camera,
  Upload,
} from "lucide-react";
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
import { api } from "@/services/api";
import { CameraModal } from "@/components/ui/camera-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarketplaceListing, useDeleteListing, useUpdateListing } from "@/hooks/useMarketplace";
import { useUserRatingSummary } from "@/hooks/useReviews";
import { useStartConversation } from "@/hooks/useMessaging";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const categories = [
  { value: "textbooks", label: "Textbooks" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture" },
  { value: "clothing", label: "Clothing" },
  { value: "tickets", label: "Tickets" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [selectedImage, setSelectedImage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: listing, isLoading } = useMarketplaceListing(listingId);

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Marketplace</h1>
            <p className="text-sm text-gray-400">Buy & sell with verified students</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <ShoppingBag className="w-10 h-10 text-red-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to view this listing</h2>
          <p className="text-gray-400 mb-6 max-w-md">
            Browse and buy from verified York University students.
          </p>
          <Link href="/auth/login">
            <Button className="bg-red-500 hover:bg-red-600">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  const { data: sellerRating } = useUserRatingSummary(listing?.seller.id || "");
  const deleteListingMutation = useDeleteListing();
  const updateListingMutation = useUpdateListing();
  const startConversationMutation = useStartConversation();

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleEditOpen = () => {
    if (!listing) return;
    setEditTitle(listing.title);
    setEditDescription(listing.description);
    setEditPrice(String(listing.price));
    setEditCategory(listing.category);
    setEditCondition(listing.condition);
    setEditImages(listing.images || []);
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    try {
      await updateListingMutation.mutateAsync({
        id: listingId,
        data: {
          title: editTitle,
          description: editDescription,
          price: parseFloat(editPrice),
          category: editCategory,
          condition: editCondition,
          images: editImages,
        },
      });
      toast({ title: "Listing updated" });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update listing",
        variant: "destructive",
      });
    }
  };

  const handleCameraCapture = async (file: File) => {
    if (editImages.length >= 5) return;
    setIsUploadingImage(true);
    try {
      const { public_url } = await api.marketplace.uploadImageDirect(file);
      setEditImages((prev) => [...prev, public_url]);
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (editImages.length >= 5) {
      toast({ title: "Maximum 5 images", variant: "destructive" });
      return;
    }
    setIsUploadingImage(true);
    try {
      for (const file of Array.from(files)) {
        if (editImages.length >= 5) break;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          toast({ title: "Invalid file type", description: "Only JPEG, PNG, WebP allowed", variant: "destructive" });
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
          continue;
        }
        const { public_url } = await api.marketplace.uploadImageDirect(file);
        setEditImages((prev) => [...prev, public_url]);
      }
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    try {
      if (isAdminUser && user?.id !== listing?.seller.id) {
        await api.admin.deleteListing(listingId);
      } else {
        await deleteListingMutation.mutateAsync(listingId);
      }
      toast({ title: "Listing deleted" });
      router.push("/marketplace");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete listing",
        variant: "destructive",
      });
    }
  };

  const handleMarkSold = async () => {
    try {
      await updateListingMutation.mutateAsync({
        id: listingId,
        data: { status: "sold" },
      });
      toast({ title: "Marked as sold" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update listing",
        variant: "destructive",
      });
    }
  };

  const handleContact = async () => {
    if (!listing) return;

    try {
      const conversation = await startConversationMutation.mutateAsync({
        recipient_id: listing.seller.id,
        initial_message: `Hi! I'm interested in your listing: "${listing.title}"`,
        context_type: "marketplace",
        context_id: listing.id,
      });
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Skeleton className="w-24 h-8 mb-6" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="w-3/4 h-8" />
            <Skeleton className="w-1/4 h-10" />
            <Skeleton className="w-full h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl text-center">
        <p className="text-gray-400">Listing not found</p>
        <Button variant="link" asChild>
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const isAdminUser = user?.is_admin === true || user?.email?.toLowerCase() === "yorkpulse.app@gmail.com";
  const isOwner = user?.id === listing.seller.id || isAdminUser;
  const images = listing.images?.length ? listing.images : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/marketplace">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-xl bg-white overflow-hidden">
            {images.length > 0 ? (
              <img
                src={images[selectedImage]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-16 h-16 text-gray-700" />
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors",
                    selectedImage === i ? "border-red-500" : "border-transparent"
                  )}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {isEditing ? (
            <>
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageUpload} />
              <CameraModal open={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="focus-visible:ring-red-500" />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="min-h-[100px] focus-visible:ring-red-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="focus-visible:ring-red-500" />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select value={editCondition} onValueChange={setEditCondition}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {conditions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Image management */}
              <div className="space-y-2">
                <Label>Photos (up to 5)</Label>
                <div className="flex flex-wrap gap-2">
                  {editImages.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-100">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {editImages.length < 5 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPhotoMenu((v) => !v)}
                        disabled={isUploadingImage}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 hover:border-red-500/50 transition-colors flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-red-700"
                      >
                        {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ImagePlus className="w-5 h-5" /><span className="text-[10px]">Add</span></>}
                      </button>
                      {showPhotoMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-40 rounded-xl bg-white border border-gray-100 shadow-xl overflow-hidden z-50">
                          <button type="button" onClick={() => { setShowPhotoMenu(false); setIsCameraOpen(true); }} className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                            <Camera className="w-4 h-4" /> Take Photo
                          </button>
                          <button type="button" onClick={() => { setShowPhotoMenu(false); fileInputRef.current?.click(); }} className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                            <Upload className="w-4 h-4" /> Upload Photo
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button onClick={handleEditSave} disabled={updateListingMutation.isPending} className="flex-1 bg-red-600 hover:bg-red-700">
                  {updateListingMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </>
          ) : (
            <>
          {/* Status Badge */}
          {listing.status !== "active" && (
            <Badge variant="secondary" className="bg-gray-100">
              {listing.status === "sold" ? "Sold" : listing.status}
            </Badge>
          )}

          {/* Title & Price */}
          <div>
            <h1 className="text-2xl font-bold mb-2">{listing.title}</h1>
            <p className="text-3xl font-bold text-red-700">
              ${Number(listing.price).toFixed(2)}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {categories.find((c) => c.value === listing.category)?.label || listing.category}
            </Badge>
            <Badge variant="outline">
              {conditions.find((c) => c.value === listing.condition)?.label || listing.condition}
            </Badge>
          </div>

          {/* Description */}
          <div className="p-4 rounded-lg bg-white border border-gray-100 shadow-sm">
            <p className="text-gray-700 whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Posted Time */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            Posted {timeAgo(listing.created_at)}
          </div>
          </>
          )}

          {/* Actions */}
          {!isEditing && (isOwner ? (
            <div className="flex gap-2">
              <Button
                onClick={handleMarkSold}
                disabled={listing.status === "sold"}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {listing.status === "sold" ? "Sold" : "Mark as Sold"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEditOpen}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit listing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-700">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete listing
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            isAuthenticated && (
              <Button
                onClick={handleContact}
                className="w-full bg-red-500 hover:bg-red-600"
                disabled={startConversationMutation.isPending}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Seller
              </Button>
            )
          ))}

          {/* Seller Card */}
          <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={listing.seller.avatar_url || undefined} />
                <AvatarFallback className="bg-red-500/20 text-red-700">
                  {listing.seller.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{listing.seller.name}</p>
                {sellerRating?.marketplace_rating && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    {sellerRating.marketplace_rating.toFixed(1)}
                    <span className="text-gray-500">
                      ({sellerRating.marketplace_count} reviews)
                    </span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/profile/${listing.seller.id}`}>View Profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
