import { ProfileScreen } from '@/components/profile-screen';
import { ScreenState } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';

export default function CurrentProfileScreen() {
  const { profile } = useAuth();
  if (!profile?.username) return <ScreenState label="Loading profile..." />;
  return <ProfileScreen username={profile.username} />;
}
