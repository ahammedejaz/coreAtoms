/**
 * theme.js — Design tokens and color palette.
 * Premium design system matching Core Atoms brand identity.
 */

export const COLORS = {
  primary: '#1e3a5f',       // dark navy (brand color)
  primaryLight: '#2a5080',
  primaryDark: '#152d4a',
  primaryGradientStart: '#1e3a5f',
  primaryGradientEnd: '#2a5080',
  accent: '#3b82f6',        // vibrant blue accent
  accentLight: '#60a5fa',
  white: '#FFFFFF',
  black: '#000000',
  background: '#F7F5F2',    // warm cream off-white
  surface: '#FFFFFF',
  surfaceElevated: '#FEFEFE',
  border: '#E8E4DE',        // warm stone
  borderLight: '#F0EDE8',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textOnPrimary: '#FFFFFF',
  success: '#059669',
  successLight: '#d1fae5',
  error: '#dc2626',
  errorLight: '#fef2f2',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  info: '#1e3a5f',
  star: '#f59e0b',
  gold: '#D4A853',
  overlay: 'rgba(0,0,0,0.5)',
  shimmer: '#e5e7eb',
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.textPrimary },
  medium: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  semibold: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  bold: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  h1: { fontSize: 30, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  caption: { fontSize: 12, color: COLORS.textSecondary },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.primary },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const ANIM = {
  fast: 200,
  normal: 350,
  slow: 500,
  spring: { damping: 15, stiffness: 150, mass: 1 },
};

/**
 * Warehouse state for GST intra/inter-state determination.
 * Used by CheckoutScreen and OrdersScreen for CGST/SGST vs IGST.
 */
export const WAREHOUSE_STATE = 'andhra pradesh';

/** WhatsApp support number (with country code, no + prefix) */
export const SUPPORT_WHATSAPP = '918331833102';
