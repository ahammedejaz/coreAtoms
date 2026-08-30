/**
 * ProfileScreen — Professional account page with profile header,
 * CoreCoins, saved addresses (edit + delete), and quick actions.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { fetchUserAddresses, deleteAddress, updateAddress } from '../services/addresses';
import { supabase } from '../services/supabase/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import FloatingShapes from '../components/FloatingShapes';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);

  // Edit address
  const [editingAddress, setEditingAddress] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [addrs, wallet] = await Promise.all([
        fetchUserAddresses(user.id),
        supabase.from('corecoins_wallet').select('balance').eq('user_id', user.id).maybeSingle(),
      ]);
      setAddresses(addrs);
      setCoinBalance(wallet.data?.balance || 0);
    } catch (err) {
      console.warn('Profile load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteAddress = (addrId) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteAddress(addrId, user.id);
            setAddresses((prev) => prev.filter((a) => a.id !== addrId));
            showToast('Address deleted', 'success');
          } catch (err) {
            showToast('Failed to delete address', 'error');
          }
        },
      },
    ]);
  };

  const startEditAddress = (addr) => {
    setEditingAddress(addr);
    setEditForm({
      fullName: addr.full_name || '',
      phone: addr.phone || '',
      line1: addr.line1 || '',
      line2: addr.line2 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
    });
  };

  const saveEditedAddress = async () => {
    if (!editForm.fullName.trim() || !editForm.phone.trim() || !editForm.line1.trim() ||
        !editForm.city.trim() || !editForm.state.trim() || !editForm.pincode.trim()) {
      showToast('Please fill all required fields', 'warning');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(editForm.phone.trim())) {
      showToast('Enter a valid 10-digit phone number', 'warning');
      return;
    }
    if (!/^\d{6}$/.test(editForm.pincode.trim())) {
      showToast('Enter a valid 6-digit pincode', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateAddress(editingAddress.id, user.id, editForm);
      showToast('Address updated', 'success');
      setEditingAddress(null);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update address', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const initials = (profile?.full_name || user?.email || '?')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <>
      <View style={styles.container}>
        <FloatingShapes />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
        >
        {/* Profile Header */}
        <View style={styles.headerBg}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.headerName}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.headerEmail}>{user?.email}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="diamond" size={20} color={COLORS.gold} />
            </View>
            <Text style={styles.statValue}>{coinBalance}</Text>
            <Text style={styles.statLabel}>CoreCoins</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{addresses.length}</Text>
            <Text style={styles.statLabel}>Addresses</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.actionsCard}>
            <Pressable style={styles.actionRow} onPress={() => navigation.navigate('OrdersTab')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="receipt-outline" size={20} color={COLORS.success} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>My Orders</Text>
                  <Text style={styles.actionSubtitle}>Track and manage your orders</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </Pressable>

            <View style={styles.actionDivider} />

            <Pressable style={styles.actionRow} onPress={() => navigation.navigate('ShopTab')}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="grid-outline" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Browse Products</Text>
                  <Text style={styles.actionSubtitle}>Explore our full catalogue</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </Pressable>

            <View style={styles.actionDivider} />

            <Pressable
              style={styles.actionRow}
              onPress={() => navigation.navigate('DeliveredSupport')}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}> 
                  <Ionicons name="logo-whatsapp" size={20} color={COLORS.success} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Delivered Order Support</Text>
                  <Text style={styles.actionSubtitle}>Reach us on WhatsApp for post-delivery concerns</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Saved Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
          {addresses.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="location-outline" size={28} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No saved addresses</Text>
              <Text style={styles.emptySubtext}>Addresses added during checkout will appear here</Text>
            </View>
          ) : (
            addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <View style={styles.addressLeft}>
                  <View style={styles.addressIconCircle}>
                    <Ionicons name="location" size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressName}>{addr.full_name}</Text>
                    <Text style={styles.addressLine}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</Text>
                    <Text style={styles.addressLine}>{addr.city}, {addr.state} - {addr.pincode}</Text>
                    <View style={styles.phoneRow}>
                      <Ionicons name="call-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.addressPhone}>{addr.phone}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.addressActions}>
                  <Pressable onPress={() => startEditAddress(addr)} hitSlop={8} style={styles.addrActionBtn}>
                    <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteAddress(addr.id)} hitSlop={8} style={[styles.addrActionBtn, styles.addrDeleteBtn]}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.accountCard}>
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue}>{user?.email}</Text>
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Name</Text>
              <Text style={styles.accountValue}>{profile?.full_name || 'Not set'}</Text>
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Member since</Text>
              <Text style={styles.accountValue}>
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                  : '-'}
              </Text>
            </View>
            <View style={styles.accountDivider} />
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>App version</Text>
              <Text style={styles.accountValue}>{Constants.expoConfig?.version || '1.0.0'}</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <View style={[styles.section, { marginBottom: SPACING.lg }]}>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
        </ScrollView>
      </View>

      {/* Edit Address Modal */}
      <Modal visible={!!editingAddress} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Address</Text>
              <Pressable onPress={() => setEditingAddress(null)} hitSlop={12} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalForm}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={editForm.fullName}
                onChangeText={(t) => setEditForm({ ...editForm, fullName: t })}
                placeholder="Full name"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={editForm.phone}
                onChangeText={(t) => setEditForm({ ...editForm, phone: t })}
                placeholder="Phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Address Line 1 *</Text>
              <TextInput
                style={styles.input}
                value={editForm.line1}
                onChangeText={(t) => setEditForm({ ...editForm, line1: t })}
                placeholder="Street address"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Address Line 2</Text>
              <TextInput
                style={styles.input}
                value={editForm.line2}
                onChangeText={(t) => setEditForm({ ...editForm, line2: t })}
                placeholder="Apartment, suite, etc. (optional)"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.city}
                    onChangeText={(t) => setEditForm({ ...editForm, city: t })}
                    placeholder="City"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>State *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.state}
                    onChangeText={(t) => setEditForm({ ...editForm, state: t })}
                    placeholder="State"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Pincode *</Text>
              <TextInput
                style={styles.input}
                value={editForm.pincode}
                onChangeText={(t) => setEditForm({ ...editForm, pincode: t.replace(/\D/g, '').slice(0, 6) })}
                placeholder="6-digit pincode"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </ScrollView>

            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEditedAddress}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Header
  headerBg: {
    backgroundColor: COLORS.primary,
    paddingTop: 28, paddingBottom: 32,
    alignItems: 'center',
    borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
  },
  avatarOuter: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  headerName: { fontSize: 20, fontWeight: '700', color: COLORS.white, marginBottom: 2 },
  headerEmail: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: SPACING.md,
    marginHorizontal: SPACING.lg, marginTop: -20,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, alignItems: 'center', ...SHADOWS.md,
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },

  // Section
  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary,
    letterSpacing: 1.5, marginBottom: SPACING.md,
  },

  // Quick Actions
  actionsCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  actionIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  actionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  actionSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  actionDivider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.lg },

  // Addresses
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.xxl, alignItems: 'center', ...SHADOWS.sm,
  },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },

  addressCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  addressLeft: { flex: 1, flexDirection: 'row', gap: SPACING.md },
  addressIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  addressInfo: { flex: 1 },
  addressName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 3 },
  addressLine: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  addressPhone: { fontSize: 12, color: COLORS.textMuted },
  addressActions: { justifyContent: 'center', gap: SPACING.sm },
  addrActionBtn: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  addrDeleteBtn: { backgroundColor: '#fef2f2' },

  // Account info
  accountCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.sm,
  },
  accountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
  },
  accountLabel: { fontSize: 13, color: COLORS.textMuted },
  accountValue: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, textAlign: 'right', flex: 1, marginLeft: SPACING.lg },
  accountDivider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.lg },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: 14, borderRadius: RADIUS.md,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: COLORS.error },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, maxHeight: '85%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center',
  },
  modalForm: { marginBottom: SPACING.lg },
  inputLabel: {
    fontSize: 12, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: SPACING.md,
  },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.background,
  },
  formRow: { flexDirection: 'row', gap: SPACING.md },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginBottom: SPACING.md,
  },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
