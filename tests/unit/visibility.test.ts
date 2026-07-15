import { describe, expect, it } from "vitest";
import { canViewProfile } from "../../src/domain/social/visibility";

describe("profile visibility", () => {
  it("always lets the owner view their own profile", () => {
    expect(
      canViewProfile({ ownerId: "ori", viewerId: "ori", visibility: "private" }),
    ).toBe(true);
  });

  it("requires an accepted friendship for friends-only profiles", () => {
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "sam",
        visibility: "friends",
        acceptedFriendIds: ["sam"],
      }),
    ).toBe(true);
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "lee",
        visibility: "friends",
        acceptedFriendIds: ["sam"],
      }),
    ).toBe(false);
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "lee",
        visibility: "friends",
      }),
    ).toBe(false);
  });

  it("requires shared membership for group-scoped profiles", () => {
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "lee",
        visibility: "groups",
        ownerGroupIds: ["friday-loop"],
        viewerGroupIds: ["friday-loop"],
      }),
    ).toBe(true);
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "lee",
        visibility: "groups",
        ownerGroupIds: ["friday-loop"],
        viewerGroupIds: ["sunday-jazz"],
      }),
    ).toBe(false);
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "lee",
        visibility: "groups",
        viewerGroupIds: ["friday-loop"],
      }),
    ).toBe(false);
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "lee",
        visibility: "groups",
        ownerGroupIds: ["friday-loop"],
      }),
    ).toBe(false);
  });

  it("allows anonymous viewers only for public profiles", () => {
    expect(
      canViewProfile({ ownerId: "ori", viewerId: null, visibility: "public" }),
    ).toBe(true);
    expect(
      canViewProfile({ ownerId: "ori", viewerId: null, visibility: "friends" }),
    ).toBe(false);
    expect(
      canViewProfile({
        ownerId: "ori",
        viewerId: "sam",
        visibility: "private",
      }),
    ).toBe(false);
  });
});
