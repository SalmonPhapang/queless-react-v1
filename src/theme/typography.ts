import type { TextStyle } from 'react-native';
import { Typography as CoreTypography } from '@queless/core/theme';
import type { TypographyKey } from '@queless/core/theme';

/** Shared Plus Jakarta Sans semantic styles. Source of truth: @queless/core. */
export const Typography = CoreTypography as unknown as Record<TypographyKey, TextStyle>;
export type { TypographyKey };
