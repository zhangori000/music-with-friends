export type ProfileVisibility = "private" | "friends" | "groups" | "public";

type VisibilityInput = {
  ownerId: string;
  viewerId: string | null;
  visibility: ProfileVisibility;
  acceptedFriendIds?: readonly string[];
  ownerGroupIds?: readonly string[];
  viewerGroupIds?: readonly string[];
};

export function canViewProfile(input: VisibilityInput): boolean {
  if (input.viewerId === input.ownerId) return true;
  if (input.visibility === "public") return true;
  if (!input.viewerId || input.visibility === "private") return false;

  if (input.visibility === "friends") {
    return input.acceptedFriendIds?.includes(input.viewerId) ?? false;
  }

  const ownerGroups = new Set(input.ownerGroupIds ?? []);
  return (input.viewerGroupIds ?? []).some((groupId) => ownerGroups.has(groupId));
}
