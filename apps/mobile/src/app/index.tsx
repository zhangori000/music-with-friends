import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchDashboard,
  formatMinutes,
  type DashboardSnapshot,
  type RangePreset,
} from "@/lib/dashboard-client";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const colors = {
  ink: "#11110F",
  paper: "#F2EFE6",
  muted: "#A9A497",
  line: "#34342F",
  acid: "#D9FF57",
  coral: "#FF735E",
  lime: "#A7E86D",
  blue: "#6DB7FF",
  violet: "#B491FF",
  gold: "#FFD05B",
  orange: "#F49A54",
  green: "#55C99A",
  pink: "#F48DBA",
} as const;

const ranges: Array<{ id: RangePreset; label: string }> = [
  { id: "this_week", label: "Week" },
  { id: "this_month", label: "Month" },
  { id: "this_year", label: "Year" },
  { id: "all_time", label: "All" },
];

function accent(name: string): string {
  return colors[name as keyof typeof colors] ?? colors.acid;
}

export default function HomeScreen() {
  const [range, setRange] = useState<RangePreset>("this_week");
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: RangePreset, signal?: AbortSignal) => {
    setIsRefreshing(true);
    setError(null);
    try {
      setDashboard(await fetchDashboard(API_BASE_URL, nextRange, fetch, signal));
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(
        "The shared API is unavailable. Start the web app or set EXPO_PUBLIC_API_BASE_URL to its public URL.",
      );
    } finally {
      if (!signal?.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDashboard(API_BASE_URL, "this_week", fetch, controller.signal)
      .then(setDashboard)
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(
          "The shared API is unavailable. Start the web app or set EXPO_PUBLIC_API_BASE_URL to its public URL.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, []);

  async function changeRange(nextRange: RangePreset) {
    if (nextRange === range) return;
    setRange(nextRange);
    await load(nextRange);
  }

  const selectedName = dashboard?.members.find(
    (member) => member.id === selectedMember,
  )?.displayName;
  const recent = selectedName
    ? dashboard?.recent.filter((track) => track.playedBy === selectedName)
    : dashboard?.recent;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => load(range)} tintColor={colors.acid} />
        }
      >
        <View style={styles.header}>
          <View style={styles.brandMark}><View style={styles.brandDot} /></View>
          <Text style={styles.brand}>Music with Friends</Text>
          <View style={styles.demoPill}><Text style={styles.demoPillText}>◆ DEMO</Text></View>
        </View>

        {!dashboard && isRefreshing ? (
          <View style={styles.loading}><ActivityIndicator color={colors.acid} /><Text style={styles.muted}>Loading the listening room…</Text></View>
        ) : error && !dashboard ? (
          <View style={styles.errorCard}><Text style={styles.errorTitle}>Can’t reach the room</Text><Text style={styles.errorBody}>{error}</Text><Pressable style={styles.primaryButton} onPress={() => load(range)}><Text style={styles.primaryButtonText}>Try again</Text></Pressable></View>
        ) : dashboard ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>LISTENING ROOM · {String(dashboard.group.memberCount).padStart(2, "0")}</Text>
              <Text style={styles.title}>{dashboard.group.name}</Text>
              <Text style={styles.subtitle}>{dashboard.group.description}</Text>
            </View>

            <View style={styles.rangeRow} accessibilityRole="tablist">
              {ranges.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: range === option.id }}
                  style={[styles.rangeButton, range === option.id && styles.rangeButtonActive]}
                  onPress={() => changeRange(option.id)}
                >
                  <Text style={[styles.rangeText, range === option.id && styles.rangeTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.statFeatured}>
              <Text style={styles.statLabelDark}>Time listened</Text>
              <Text style={styles.statValueDark}>{formatMinutes(dashboard.summary.listenedMinutes.value)}</Text>
              <Text style={styles.statMetaDark}>{dashboard.summary.listenedMinutes.quality} duration coverage</Text>
            </View>
            <View style={styles.statPair}>
              <View style={styles.statCard}><Text style={styles.statLabel}>Track starts</Text><Text style={styles.statValue}>{dashboard.summary.playCount.toLocaleString()}</Text><Text style={styles.statMeta}>{dashboard.summary.uniqueTrackCount.toLocaleString()} unique</Text></View>
              <View style={styles.statCard}><Text style={styles.statLabel}>Top artist</Text><Text style={styles.statName}>{dashboard.summary.topArtist?.name ?? "—"}</Text><Text style={styles.statMeta}>{dashboard.summary.topArtist?.playCount ?? 0} listens</Text></View>
            </View>

            <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>THE CREW</Text><Text style={styles.sectionTitle}>Who’s spinning</Text></View>{selectedMember && <Pressable onPress={() => setSelectedMember(null)}><Text style={styles.clear}>Show all</Text></Pressable>}</View>
            <View style={styles.memberList}>
              {dashboard.members.map((member, index) => (
                <Pressable key={member.id} style={[styles.memberRow, selectedMember === member.id && styles.memberRowSelected]} onPress={() => setSelectedMember(member.id)} accessibilityLabel={`Show ${member.displayName}'s recent listening`} accessibilityState={{ selected: selectedMember === member.id }}>
                  <Text style={styles.rank}>{String(index + 1).padStart(2, "0")}</Text>
                  <View style={[styles.avatar, { backgroundColor: accent(member.accent) }]}><Text style={styles.avatarText}>{member.initials}</Text></View>
                  <View style={styles.memberCopy}><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.memberMeta}>{member.topArtist}</Text></View>
                  <View style={styles.memberNumbers}><Text style={styles.memberName}>{formatMinutes(member.listenedMinutes)}</Text><Text style={styles.memberMeta}>{member.playCount} listens</Text></View>
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>LIVE SHELF</Text><Text style={styles.sectionTitle}>{selectedName ? `${selectedName} played` : "Recently played"}</Text></View></View>
            <View style={styles.trackList}>
              {recent?.map((track) => (
                <View key={track.id} style={styles.trackRow}>
                  <View style={[styles.cover, { backgroundColor: accent(track.accent) }]}><Text style={styles.coverText}>{track.title.slice(0, 1)}</Text></View>
                  <View style={styles.trackCopy}><Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artist} · {track.playedBy}</Text></View>
                  <Pressable accessibilityLabel={`Open ${track.title} in Spotify`} style={styles.openButton} onPress={() => Linking.openURL(track.externalUrl)}><Text style={styles.openButtonText}>↗</Text></Pressable>
                </View>
              ))}
            </View>

            <View style={styles.policyCard}><Text style={styles.eyebrowDark}>PROVIDER BOUNDARY</Text><Text style={styles.policyTitle}>Demo history, intentionally.</Text><Text style={styles.policyBody}>Spotify’s current policy blocks apps from creating new listener metrics. Live analytics will come from a consented, policy-compatible history source.</Text></View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.ink },
  scroll: { flex: 1, backgroundColor: colors.ink },
  content: { paddingBottom: 64 },
  header: { minHeight: 64, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line },
  brandMark: { width: 25, height: 25, borderRadius: 13, borderWidth: 5, borderColor: "#30302A", backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  brandDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.acid },
  brand: { color: colors.paper, fontSize: 14, fontWeight: "700", marginLeft: 9 },
  demoPill: { marginLeft: "auto", borderWidth: 1, borderColor: "#66762F", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  demoPillText: { color: colors.acid, fontSize: 8, fontWeight: "700" },
  loading: { minHeight: 500, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { color: colors.muted, fontSize: 13 },
  errorCard: { margin: 20, padding: 24, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  errorTitle: { color: colors.paper, fontSize: 24, fontWeight: "700", marginBottom: 10 },
  errorBody: { color: colors.muted, lineHeight: 21, marginBottom: 20 },
  primaryButton: { alignSelf: "flex-start", backgroundColor: colors.acid, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11 },
  primaryButtonText: { color: colors.ink, fontWeight: "700" },
  hero: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 42 },
  eyebrow: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  eyebrowDark: { color: "#716D62", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.paper, fontSize: 58, fontWeight: "800", letterSpacing: -4, lineHeight: 55, marginTop: 14 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 18 },
  rangeRow: { marginHorizontal: 18, marginBottom: 18, padding: 4, flexDirection: "row", backgroundColor: "#1C1C19", borderRadius: 24 },
  rangeButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 20 },
  rangeButtonActive: { backgroundColor: colors.paper },
  rangeText: { color: colors.muted, fontSize: 11 },
  rangeTextActive: { color: colors.ink, fontWeight: "700" },
  statFeatured: { backgroundColor: colors.acid, padding: 24, minHeight: 154, justifyContent: "space-between" },
  statLabelDark: { color: "#5C6B27", fontSize: 11 },
  statValueDark: { color: colors.ink, fontSize: 43, fontWeight: "800", letterSpacing: -2.5 },
  statMetaDark: { color: "#5C6B27", fontSize: 10 },
  statPair: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line },
  statCard: { flex: 1, minHeight: 148, padding: 20, justifyContent: "space-between", borderRightWidth: 1, borderRightColor: colors.line },
  statLabel: { color: colors.muted, fontSize: 10 },
  statValue: { color: colors.paper, fontSize: 36, fontWeight: "800", letterSpacing: -2 },
  statName: { color: colors.paper, fontSize: 23, lineHeight: 24, fontWeight: "700", letterSpacing: -1 },
  statMeta: { color: colors.muted, fontSize: 9 },
  sectionHeader: { marginTop: 48, paddingHorizontal: 18, marginBottom: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { color: colors.paper, fontSize: 27, fontWeight: "700", letterSpacing: -1.3, marginTop: 7 },
  clear: { color: colors.acid, fontSize: 11, fontWeight: "700" },
  memberList: { marginHorizontal: 18, borderTopWidth: 1, borderTopColor: colors.line },
  memberRow: { minHeight: 66, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 4 },
  memberRowSelected: { backgroundColor: "#1B1B18" },
  rank: { color: "#69655C", fontSize: 9, width: 28 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 11 },
  avatarText: { color: colors.ink, fontWeight: "800" },
  memberCopy: { flex: 1 },
  memberNumbers: { alignItems: "flex-end" },
  memberName: { color: colors.paper, fontSize: 12, fontWeight: "700" },
  memberMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  trackList: { marginHorizontal: 18, borderTopWidth: 1, borderTopColor: colors.line },
  trackRow: { minHeight: 66, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line },
  cover: { width: 42, height: 42, borderRadius: 3, alignItems: "center", justifyContent: "center", marginRight: 11 },
  coverText: { color: colors.ink, fontWeight: "900" },
  trackCopy: { flex: 1, minWidth: 0 },
  trackTitle: { color: colors.paper, fontSize: 12, fontWeight: "700" },
  trackArtist: { color: colors.muted, fontSize: 9, marginTop: 4 },
  openButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  openButtonText: { color: colors.paper, fontSize: 14 },
  policyCard: { margin: 18, marginTop: 50, padding: 24, backgroundColor: "#E7E1D4", borderRadius: 4 },
  policyTitle: { color: colors.ink, fontSize: 25, fontWeight: "700", letterSpacing: -1, marginTop: 9 },
  policyBody: { color: "#625F56", fontSize: 12, lineHeight: 18, marginTop: 10 },
});
