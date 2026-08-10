import { Asset } from 'expo-asset';
import Svg, { Circle, Image as SvgImage, Path, Rect } from 'react-native-svg';

import { Palette } from '@/constants/theme';

export type DiscTone = 'gold' | 'silver' | 'copper';
export type DiscFill = 'full' | 'half' | 'empty';
export type DiscPresentation = 'standard' | 'aggregate';

type RatingDiscProps = {
  fill?: DiscFill;
  presentation?: DiscPresentation;
  size?: number;
  tone?: DiscTone;
};

const faces = {
  gold: Asset.fromModule(require('@/assets/images/alby/disc-gold.png')).uri,
  silver: Asset.fromModule(require('@/assets/images/alby/disc-silver.png')).uri,
  copper: Asset.fromModule(require('@/assets/images/alby/disc-copper.png')).uri,
};

const centers = {
  gold: {
    ringFill: '#FAEEC9',
    ringStroke: '#FFE38E',
    holeFill: Palette.canvas,
    holeStroke: '#EFC679',
  },
  silver: {
    ringFill: '#FAFAFA',
    ringStroke: '#E0E0E0',
    holeFill: '#FFFFFF',
    holeStroke: '#CFCFCF',
  },
  copper: {
    ringFill: '#DFCCB9',
    ringStroke: '#DAB38B',
    holeFill: '#E7E3DF',
    holeStroke: '#BE9C83',
  },
};

export function RatingDisc({ fill = 'full', presentation = 'standard', size = 20, tone = 'gold' }: RatingDiscProps) {
  const center = centers[tone];

  return (
    <Svg
      accessibilityLabel={`${presentation === 'aggregate' ? 'aggregate' : fill} ${tone} rating disc`}
      accessibilityRole="image"
      height={size}
      viewBox="0 0 100 100"
      width={size}>
      {fill === 'empty' ? (
        <Circle
          cx="50"
          cy="50"
          fill={Palette.canvas}
          r="48"
          stroke={Palette.border}
          strokeOpacity={0.92}
          strokeWidth="4"
        />
      ) : (
        <>
          <SvgImage
            height="100"
            href={{ uri: faces[tone] }}
            preserveAspectRatio="xMidYMid slice"
            width="100"
          />
          <Circle
            cx="50"
            cy="50"
            fill={center.ringFill}
            fillOpacity={0.5}
            r="14"
            stroke={center.ringStroke}
            strokeOpacity={0.3}
          />
          <Circle
            cx="50"
            cy="50"
            fill={center.holeFill}
            r="7.5"
            stroke={center.holeStroke}
          />
          {presentation === 'aggregate' ? (
            <Rect fill={Palette.canvas} height="100" width="50" x="50" y="0" />
          ) : fill === 'half' && (
            <Path
              d="M52 2.041C77.582 3.09 98 24.16 98 50S77.582 96.91 52 97.958V2.041Z"
              fill={Palette.canvas}
              stroke={Palette.border}
              strokeWidth="4"
            />
          )}
        </>
      )}
    </Svg>
  );
}
