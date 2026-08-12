import { useLocalSearchParams } from 'expo-router';

import { CommentsSheet } from '@/features/comments/comments-sheet';

export default function CommentsScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  return <CommentsSheet activityId={activityId} />;
}
