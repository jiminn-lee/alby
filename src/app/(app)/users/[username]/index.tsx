import { useLocalSearchParams } from 'expo-router';

import { ProfileScreen } from '@/components/profile-screen';

export default function SharedProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return <ProfileScreen username={username} />;
}
