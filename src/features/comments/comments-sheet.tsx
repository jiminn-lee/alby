import { Image } from 'expo-image';
import { router } from 'expo-router';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { PaperPlaneRightIcon } from 'phosphor-react-native/src/icons/PaperPlaneRight';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  LinearTransition,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ExpandableNote } from '@/components/expandable-note';
import { AlbyButton } from '@/components/ui';
import { Fonts, Palette, PressedOpacity } from '@/constants/theme';
import {
  useActivityComments,
  useCommentLikeMutation,
  useCreateCommentMutation,
  type ActivityComment,
} from '@/features/data/hooks';
import { getMediaUrl } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';

const REPLY_BATCH_SIZE = 3;
const SHEET_COLLAPSED_RATIO = 0.25;
const SHEET_DISMISS_DISTANCE = 88;
const SHEET_FLING_VELOCITY = 850;
const SHEET_DISMISS_VELOCITY = 1100;
const SHEET_TIMING = {
  duration: 320,
  easing: Easing.out(Easing.cubic),
};

type CommentThread = {
  replies: ActivityComment[];
  root: ActivityComment;
};

type ReplyTarget = {
  authorName: string;
  rootId: string;
};

export function CommentsSheet({ activityId }: { activityId: string }) {
  const thread = useActivityComments(activityId);
  const createComment = useCreateCommentMutation(activityId);
  const commentLike = useCommentLikeMutation(activityId);
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.max(1, windowHeight - insets.top);
  const collapsedY = sheetHeight * SHEET_COLLAPSED_RATIO;
  const listRef = useRef<FlatList<CommentThread>>(null);
  const inputRef = useRef<TextInput>(null);
  const translateY = useSharedValue(collapsedY);
  const dragStartY = useSharedValue(collapsedY);
  const activeDetent = useSharedValue<'collapsed' | 'expanded' | 'dismissed'>('collapsed');
  const [body, setBody] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [visibleReplies, setVisibleReplies] = useState<Record<string, number>>({});

  const finishDismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const dismissSheet = () => {
    if (activeDetent.value === 'dismissed') return;
    activeDetent.value = 'dismissed';
    translateY.value = withTiming(sheetHeight, SHEET_TIMING, (finished) => {
      if (finished) scheduleOnRN(finishDismiss);
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-12, 12])
    .onBegin(() => {
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.min(
        sheetHeight,
        Math.max(0, dragStartY.value + event.translationY),
      );
    })
    .onEnd((event) => {
      const startedCollapsed = dragStartY.value >= collapsedY / 2;
      const shouldDismiss = startedCollapsed && (
        translateY.value >= collapsedY + SHEET_DISMISS_DISTANCE
        || event.velocityY >= SHEET_DISMISS_VELOCITY
      );

      if (shouldDismiss) {
        activeDetent.value = 'dismissed';
        translateY.value = withTiming(sheetHeight, SHEET_TIMING, (finished) => {
          if (finished) scheduleOnRN(finishDismiss);
        });
        return;
      }

      const shouldExpand = event.velocityY <= -SHEET_FLING_VELOCITY
        || (event.velocityY < SHEET_FLING_VELOCITY && translateY.value < collapsedY / 2);
      const destination = shouldExpand ? 0 : collapsedY;
      activeDetent.value = shouldExpand ? 'expanded' : 'collapsed';
      translateY.value = withTiming(destination, SHEET_TIMING);
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    top: translateY.value,
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, collapsedY, sheetHeight],
      [0.36, 0.3, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const threads: CommentThread[] = (() => {
    const items = thread.data?.items ?? [];
    const repliesByRoot = new Map<string, ActivityComment[]>();
    items.forEach((comment) => {
      if (!comment.parent_comment_id) return;
      const replies = repliesByRoot.get(comment.parent_comment_id) ?? [];
      replies.push(comment);
      repliesByRoot.set(comment.parent_comment_id, replies);
    });
    return items
      .filter((comment) => comment.parent_comment_id === null)
      .sort((left, right) => (
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        || right.id.localeCompare(left.id)
      ))
      .map((root) => ({ root, replies: repliesByRoot.get(root.id) ?? [] }));
  })();

  const beginReply = (comment: ActivityComment, rootId: string) => {
    setReplyTarget({ authorName: commentAuthorName(comment), rootId });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody || createComment.isPending || !thread.data) return;
    const rootId = replyTarget?.rootId ?? null;

    try {
      await createComment.mutateAsync({ body: trimmedBody, parentCommentId: rootId });
      setBody('');
      setReplyTarget(null);
      if (rootId) {
        const existingReplies = threads.find((item) => item.root.id === rootId)?.replies.length ?? 0;
        setVisibleReplies((current) => ({ ...current, [rootId]: existingReplies + 1 }));
        const rootIndex = threads.findIndex((item) => item.root.id === rootId);
        if (rootIndex >= 0) {
          requestAnimationFrame(() => listRef.current?.scrollToIndex({
            animated: true,
            index: rootIndex,
            viewPosition: 0.25,
          }));
        }
      } else {
        requestAnimationFrame(() => listRef.current?.scrollToOffset({ animated: true, offset: 0 }));
      }
    } catch {
      // The mutation error is rendered beneath the composer.
    }
  };

  const renderThread = ({ item }: ListRenderItemInfo<CommentThread>) => {
    const shownReplyCount = Math.min(visibleReplies[item.root.id] ?? 0, item.replies.length);
    const remainingReplyCount = item.replies.length - shownReplyCount;
    return (
      <Animated.View layout={LinearTransition.duration(180)} style={styles.thread}>
        <CommentRow
          activityAuthorId={thread.data!.activityAuthorId}
          comment={item.root}
          likePending={commentLike.isPending && commentLike.variables?.commentId === item.root.id}
          onLike={() => commentLike.mutate({ commentId: item.root.id, shouldLike: !item.root.liked_by_me })}
          onReply={() => beginReply(item.root, item.root.id)}
        />

        {item.replies.slice(0, shownReplyCount).map((reply) => (
          <Animated.View entering={FadeIn.duration(180)} key={reply.id}>
            <CommentRow
              activityAuthorId={thread.data!.activityAuthorId}
              comment={reply}
              likePending={commentLike.isPending && commentLike.variables?.commentId === reply.id}
              onLike={() => commentLike.mutate({ commentId: reply.id, shouldLike: !reply.liked_by_me })}
              onReply={() => beginReply(reply, item.root.id)}
              reply
            />
          </Animated.View>
        ))}

        {remainingReplyCount > 0 && (
          <Pressable
            accessibilityLabel={replyButtonLabel(remainingReplyCount, shownReplyCount > 0)}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setVisibleReplies((current) => ({
              ...current,
              [item.root.id]: Math.min(item.replies.length, shownReplyCount + REPLY_BATCH_SIZE),
            }))}
            style={({ pressed }) => [styles.revealReplies, pressed && styles.pressed]}>
            <View style={styles.replyRule} />
            <Text style={styles.replyActionText}>
              {replyButtonLabel(remainingReplyCount, shownReplyCount > 0)}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    );
  };

  const emptyContent = thread.isLoading ? (
    <View style={styles.centerState}>
      <ActivityIndicator color={Palette.brand} />
      <Text selectable style={styles.stateText}>Loading comments...</Text>
    </View>
  ) : thread.error ? (
    <View style={styles.centerState}>
      <Text accessibilityRole="alert" selectable style={styles.errorText}>{thread.error.message}</Text>
      <AlbyButton label="Try again" onPress={() => void thread.refetch()} size="compact" />
    </View>
  ) : (
    <View style={styles.centerState}>
      <Text selectable style={styles.emptyTitle}>No comments yet</Text>
      <Text selectable style={styles.stateText}>Start the conversation.</Text>
    </View>
  );

  const composerError = createComment.error?.message ?? commentLike.error?.message;
  const trimmedBody = body.trim();

  return (
    <View style={styles.overlay}>
      <Animated.View pointerEvents="none" style={[styles.backdrop, backdropAnimatedStyle]} />
      <Pressable
        accessibilityLabel="Close comments"
        accessibilityRole="button"
        onPress={dismissSheet}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        entering={SlideInDown.duration(SHEET_TIMING.duration).easing(SHEET_TIMING.easing)}
        pointerEvents="box-none"
        style={[styles.sheetContainer, { top: insets.top }]}>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={dismissSheet}
          style={[styles.sheetFrame, sheetAnimatedStyle]}>
          <KeyboardAvoidingView
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
            style={styles.sheet}>
            <GestureDetector gesture={panGesture}>
              <Animated.View style={styles.header}>
                <View style={styles.grabber} />
                <Text accessibilityRole="header" selectable style={styles.title}>Comments</Text>
              </Animated.View>
            </GestureDetector>

            <FlatList
              ref={listRef}
              contentContainerStyle={[styles.listContent, threads.length === 0 && styles.emptyListContent]}
              contentInsetAdjustmentBehavior="never"
              data={threads}
              extraData={visibleReplies}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.root.id}
              ListEmptyComponent={emptyContent}
              onScrollToIndexFailed={(info) => listRef.current?.scrollToOffset({
                animated: true,
                offset: Math.max(0, info.averageItemLength * info.index),
              })}
              renderItem={renderThread}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />

            <View style={[styles.composer, { paddingBottom: Math.max(16, insets.bottom) }]}>
              {replyTarget && (
                <View style={styles.replyingTo}>
                  <Text numberOfLines={1} style={styles.replyingToText}>
                    Replying to {replyTarget.authorName}
                  </Text>
                  <Pressable
                    accessibilityLabel="Cancel reply"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setReplyTarget(null)}
                    style={({ pressed }) => [styles.cancelReply, pressed && styles.pressed]}>
                    <XIcon color={Palette.muted} size={14} weight="bold" />
                  </Pressable>
                </View>
              )}

              {composerError && (
                <Text accessibilityRole="alert" selectable style={styles.composerError}>{composerError}</Text>
              )}

              <View style={styles.composerRow}>
                <CommentAvatar
                  avatarPath={profile?.avatar_path}
                  fallback={(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
                  size={32}
                />
                <TextInput
                  ref={inputRef}
                  accessibilityLabel={replyTarget ? `Reply to ${replyTarget.authorName}` : 'Add a comment'}
                  editable={Boolean(thread.data) && !createComment.isPending}
                  maxLength={500}
                  multiline
                  onChangeText={(value) => {
                    if (createComment.error) createComment.reset();
                    setBody(value);
                  }}
                  placeholder={replyTarget ? `Reply to ${replyTarget.authorName}` : 'Add a comment'}
                  placeholderTextColor={Palette.muted}
                  style={styles.input}
                  value={body}
                />
                <Pressable
                  accessibilityLabel={replyTarget ? 'Send reply' : 'Send comment'}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !trimmedBody || createComment.isPending }}
                  disabled={!trimmedBody || createComment.isPending || !thread.data}
                  hitSlop={6}
                  onPress={() => void submit()}
                  style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
                  {createComment.isPending ? (
                    <ActivityIndicator color={Palette.brand} size="small" />
                  ) : (
                    <PaperPlaneRightIcon
                      color={trimmedBody && thread.data ? Palette.brand : Palette.border}
                      size={24}
                      weight="regular"
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function CommentRow({
  activityAuthorId,
  comment,
  likePending,
  onLike,
  onReply,
  reply = false,
}: {
  activityAuthorId: string;
  comment: ActivityComment;
  likePending: boolean;
  onLike: () => void;
  onReply: () => void;
  reply?: boolean;
}) {
  const authorName = commentAuthorName(comment);
  const avatarSize = reply ? 24 : 32;
  const isActivityAuthor = comment.user_id === activityAuthorId;

  return (
    <View style={[styles.commentRow, reply && styles.replyRow]}>
      <CommentAvatar
        avatarPath={comment.author.avatar_path}
        fallback={authorName[0]?.toUpperCase() ?? '?'}
        size={avatarSize}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentMetadata}>
          <Text numberOfLines={1} selectable style={styles.commentAuthor}>{authorName}</Text>
          <Text selectable style={styles.commentTime}>
            {compactRelativeTime(comment.created_at)}{isActivityAuthor ? ' • Author' : ''}
          </Text>
        </View>
        <View style={styles.commentBodyRow}>
          <View style={styles.commentCopy}>
            <ExpandableNote collapsedLines={3} note={comment.body} style={styles.commentBody} />
            <Pressable
              accessibilityLabel={`Reply to ${authorName}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onReply}
              style={({ pressed }) => [styles.replyButton, pressed && styles.pressed]}>
              <Text style={styles.replyActionText}>Reply</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel={`${comment.liked_by_me ? 'Unlike' : 'Like'} ${authorName}'s comment`}
            accessibilityRole="button"
            accessibilityState={{ disabled: likePending, selected: comment.liked_by_me }}
            disabled={likePending}
            hitSlop={8}
            onPress={onLike}
            style={({ pressed }) => [styles.commentLike, pressed && styles.pressed]}>
            {likePending ? (
              <ActivityIndicator color={Palette.muted} size="small" />
            ) : (
              <HeartIcon
                color={comment.liked_by_me ? Palette.liked : Palette.ink}
                size={14}
                weight={comment.liked_by_me ? 'fill' : 'regular'}
              />
            )}
            <Text selectable style={styles.likeCount}>{comment.likes_count}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CommentAvatar({ avatarPath, fallback, size }: { avatarPath?: string | null; fallback: string; size: 24 | 32 }) {
  const avatarUrl = getMediaUrl(avatarPath);
  return avatarUrl ? (
    <Image
      accessibilityLabel={`${fallback} avatar`}
      source={avatarUrl}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: Palette.border }}
    />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, size === 24 && styles.replyAvatarInitial]}>{fallback}</Text>
    </View>
  );
}

function commentAuthorName(comment: ActivityComment) {
  return comment.author.display_name?.trim().split(/\s+/)[0]
    || comment.author.username
    || 'Alby user';
}

function compactRelativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
  return `${Math.floor(seconds / 2592000)}mo`;
}

function replyButtonLabel(remainingCount: number, hasVisibleReplies: boolean) {
  const noun = remainingCount === 1 ? 'reply' : 'replies';
  return hasVisibleReplies
    ? `View ${remainingCount} more ${noun}`
    : `View ${remainingCount} ${noun}`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    elevation: 1,
  },
  sheetFrame: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    flex: 1,
    overflow: 'hidden',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: Palette.border,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderCurve: 'continuous',
    backgroundColor: Palette.canvas,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  grabber: {
    width: 48,
    height: 2,
    borderRadius: 1,
    backgroundColor: Palette.border,
  },
  title: {
    color: Palette.ink,
    fontFamily: Fonts.semibold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: Palette.ink,
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 18,
  },
  stateText: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  errorText: {
    color: Palette.liked,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  thread: {
    width: '100%',
    gap: 16,
  },
  commentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  replyRow: {
    paddingLeft: 40,
  },
  avatarFallback: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: Palette.border,
  },
  avatarInitial: {
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 17,
  },
  replyAvatarInitial: {
    fontSize: 10,
    lineHeight: 12,
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  commentMetadata: {
    minHeight: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentAuthor: {
    maxWidth: '55%',
    color: Palette.ink,
    fontFamily: Fonts.semibold,
    fontSize: 12,
    lineHeight: 15,
  },
  commentTime: {
    flexShrink: 1,
    color: Palette.muted,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
  },
  commentBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  commentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  commentBody: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
  },
  replyButton: {
    minHeight: 15,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  replyActionText: {
    color: Palette.muted,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 15,
  },
  commentLike: {
    width: 30,
    minHeight: 34,
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    color: Palette.ink,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  revealReplies: {
    minHeight: 23,
    marginLeft: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 8,
  },
  replyRule: {
    width: 24,
    height: 1,
    marginBottom: 7,
    backgroundColor: Palette.border,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: 8,
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: Palette.canvas,
  },
  replyingTo: {
    minHeight: 20,
    paddingLeft: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  replyingToText: {
    flex: 1,
    color: Palette.muted,
    fontFamily: Fonts.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  cancelReply: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerError: {
    paddingLeft: 40,
    color: Palette.liked,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 14,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 33,
    maxHeight: 96,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    borderCurve: 'continuous',
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 15,
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    width: 24,
    height: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
