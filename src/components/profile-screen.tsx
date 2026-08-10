import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { Icon } from 'phosphor-react-native';
import { GearIcon } from 'phosphor-react-native/src/icons/Gear';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { UserPlusIcon } from 'phosphor-react-native/src/icons/UserPlus';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Fonts, MaxContentWidth, Palette, PressedOpacity } from '@/constants/theme';
import { useFollowMutation, useProfileFeed, useProfileOverview, useProfileRatings, useProfileSaved } from '@/features/data/hooks';
import { getMediaUrl } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';

import { AlbumListItem } from './album-list-item';
import { ActivityFeed } from './social-feed';
import { AlbyButton, ScreenState } from './ui';

type Tab = 'Feed' | 'Ratings' | 'Saved';

const Tabs: Tab[] = ['Feed', 'Ratings', 'Saved'];

export function ProfileScreen({ username }: { username: string }) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const overview = useProfileOverview(username);
  const [tab, setTab] = useState<Tab>('Feed');
  const profile = overview.data;
  const owner = profile?.id === session?.user.id;
  const allowed = profile?.can_view_content ?? false;
  const feed = useProfileFeed(profile?.id, allowed && tab === 'Feed');
  const ratings = useProfileRatings(profile?.id, allowed && tab === 'Ratings');
  const saved = useProfileSaved(profile?.id, allowed && tab === 'Saved');
  const follow = useFollowMutation();

  if (overview.isLoading) return <ScreenState label="Loading profile..." />;
  if (overview.error || !profile) return <ScreenState error={overview.error?.message ?? 'Profile not found.'} />;

  const avatar = getMediaUrl(profile.avatar_path);
  const share = () => Share.share({ message: `Find @${profile.username} on Alby: alby://users/${profile.username}` });

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + insets.bottom + 24 }]} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.profilePanel}>
          <View style={[styles.profilePadding, { paddingTop: insets.top + 24 }]}>
            <View style={styles.topBar}>
              <Text style={styles.myLabel}>{owner ? 'my' : `@${profile.username}`}</Text>
              {owner && (
                <Pressable accessibilityLabel="Settings" hitSlop={12} onPress={() => router.push('/settings')} style={({ pressed }) => pressed && styles.pressed}>
                  <GearIcon color={Palette.brand} size={22} />
                </Pressable>
              )}
            </View>

            <View style={styles.identity}>
              {avatar ? <Image source={avatar} style={styles.avatar} /> : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{(profile.display_name || profile.username)[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.identityCopy}>
                <Text style={styles.name}>{profile.display_name}</Text>
                <Text style={styles.handle}>@{profile.username}</Text>
              </View>
              <Text style={styles.member}>Member since {new Date(profile.member_since).getFullYear()}</Text>
            </View>

            <View style={styles.stats}>
              <Stat label="Ratings" value={profile.ratings_count} />
              <Stat label="Followers" value={profile.followers_count} />
              <Stat label="Following" value={profile.following_count} />
              <Stat label="Rank" value="?" />
            </View>

            <View style={styles.actions}>
              {owner ? (
                <ProfileAction label="Edit profile" onPress={() => router.push('/edit-profile')} wide />
              ) : (
                <ProfileAction label={profile.is_following ? 'Following' : 'Follow'} onPress={() => follow.mutate({ targetId: profile.id, following: profile.is_following })} wide />
              )}
              <ProfileAction label="Share profile" onPress={share} wide />
              <ProfileAction accessibilityLabel={owner ? 'Invite a friend' : 'Follow options'} icon={UserPlusIcon} onPress={() => owner ? share() : follow.mutate({ targetId: profile.id, following: profile.is_following })} />
            </View>
          </View>

          <View style={[styles.tabs, { width: Math.min(viewportWidth, MaxContentWidth) + 4 }]}>
            <View style={styles.tabItems}>
              {Tabs.map((item, index) => (
                <Fragment key={item}>
                  {index > 0 && <View style={styles.tabDivider} />}
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    onPress={() => setTab(item)}
                    style={({ pressed }) => [styles.tab, item !== 'Feed' && styles.wideTab, pressed && styles.pressed]}>
                    <View style={styles.tabLabel}>
                      <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text>
                      <View style={[styles.activeLine, tab !== item && styles.inactiveLine]} />
                    </View>
                  </Pressable>
                </Fragment>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.feedContent}>
          {!allowed ? (
            <View style={styles.locked}>
              <LockIcon color={Palette.brand} size={32} />
              <Text style={styles.lockTitle}>This profile is private</Text>
              <Text style={styles.lockCopy}>Ratings, saved albums, and activity are shared with mutual follows.</Text>
            </View>
          ) : (
            <View>
              {tab === 'Feed' && (feed.isLoading ? <ScreenState /> : feed.data?.length ? <ActivityFeed items={feed.data} /> : <Empty label="No activity yet." />)}
              {tab === 'Ratings' && (ratings.isLoading ? <ScreenState /> : ratings.data?.length ? ratings.data.map((item) => <AlbumListItem album={item.album} key={item.id} rating={item.value} />) : <Empty label="No ratings yet." />)}
              {tab === 'Saved' && (saved.isLoading ? <ScreenState /> : saved.data?.length ? saved.data.map((item) => <AlbumListItem album={item.album} key={item.id} subtitle="Listen Later" />) : <Empty label="Nothing saved yet." />)}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function ProfileAction({ accessibilityLabel, icon: IconComponent, label, onPress, wide = false }: { accessibilityLabel?: string; icon?: Icon; label?: string; onPress: () => void; wide?: boolean }) {
  return (
    <AlbyButton
      accessibilityLabel={accessibilityLabel}
      icon={IconComponent}
      label={label}
      onPress={onPress}
      size={wide ? 'compact' : 'icon'}
      style={wide && styles.wideAction}
      variant="secondary"
    />
  );
}

function Empty({ label }: { label: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  scrollContent: { alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth },
  profilePanel: { width: '100%' },
  profilePadding: { paddingHorizontal: 24 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  myLabel: { color: Palette.brand, fontFamily: Fonts.brand, fontSize: 36, lineHeight: 43 },
  identity: { alignItems: 'center', gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderColor: Palette.border, borderWidth: 1},
  avatarFallback: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.border },
  avatarInitial: { color: Palette.brand, fontFamily: Fonts.brand, fontSize: 34 },
  identityCopy: { alignItems: 'center' },
  name: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 19 },
  handle: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  member: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 10, lineHeight: 12 },
  stats: { flexDirection: 'row', paddingTop: 16, paddingBottom: 16},
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 19, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statLabel: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  actions: { width: '100%', height: 32, flexDirection: 'row', gap: 4 },
  wideAction: { flex: 1, width: 'auto' },
  tabs: { height: 41, marginTop: 24, alignSelf: 'center', overflow: 'hidden', borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderColor: Palette.border, borderBottomLeftRadius: 48, borderBottomRightRadius: 48, borderCurve: 'continuous' },
  tabItems: { position: 'absolute', top: 0, left: 0, right: 0, height: 25, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 33 },
  tabDivider: { width: 1, height: 25, backgroundColor: Palette.border },
  tab: { height: 25, alignItems: 'center', justifyContent: 'center' },
  wideTab: { width: 59 },
  tabLabel: { height: 23, alignItems: 'center', justifyContent: 'flex-start', gap: 4 },
  tabText: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 17 },
  activeTabText: { fontFamily: Fonts.semibold },
  activeLine: { alignSelf: 'stretch', height: 2, backgroundColor: Palette.brand },
  inactiveLine: { backgroundColor: 'transparent' },
  feedContent: { paddingHorizontal: 24, paddingTop: 24 },
  locked: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28 },
  lockTitle: { color: Palette.ink, fontFamily: Fonts.semibold, fontSize: 17 },
  lockCopy: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Palette.muted, fontFamily: Fonts.sans, fontSize: 13 },
  pressed: { opacity: PressedOpacity },
});
