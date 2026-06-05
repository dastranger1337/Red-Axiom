/**
 * SecretsEditor — live editor for backend (.env) + frontend (.env) keys.
 * - Reads current values from /api/functions/v1/get-secrets
 * - Writes via /api/functions/v1/set-secrets
 * - Bundled model picker fed by /api/models
 *
 * Used only inside the Config → ENV VARS tab.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const ACCENT = '#ffcc00';

interface SecretField {
  key: string;
  label: string;
  category: string;
  sensitive?: boolean;
  isModel?: boolean;
  isProvider?: boolean;
}

const EDITABLE_FIELDS: SecretField[] = [
  // ── AI ──
  { key: 'EMERGENT_LLM_KEY',       label: 'Emergent Universal LLM Key', category: 'AI',     sensitive: true  },
  { key: 'ONSPACE_AI_BASE_URL',    label: 'Emergent LLM Base URL',      category: 'AI'                       },
  { key: 'DEFAULT_LLM_PROVIDER',   label: 'Default Provider',           category: 'AI',     isProvider: true },
  { key: 'DEFAULT_LLM_MODEL',      label: 'Default Model',              category: 'AI',     isModel: true    },
  // ── Supabase / runtime ──
  { key: 'EXPO_PUBLIC_AXIOM_RUNTIME_URL', label: 'AXIOM Runtime URL',   category: 'Runtime'                  },
  { key: 'EXPO_PUBLIC_SUPABASE_URL',      label: 'Supabase URL',        category: 'Supabase'                 },
  { key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key',   category: 'Supabase', sensitive: true},
  { key: 'SUPABASE_SERVICE_ROLE_KEY',     label: 'Supabase Svc Role',   category: 'Supabase', sensitive: true},
  { key: 'SUPABASE_DB_URL',               label: 'Supabase DB URL',     category: 'Supabase', sensitive: true},
  // ── Storage ──
  { key: 'MONGO_URL', label: 'MongoDB URL', category: 'Storage', sensitive: true },
  { key: 'DB_NAME',   label: 'DB Name',     category: 'Storage'                 },
];

interface Props {
  secrets: Record<string, string>;
  loaded: boolean;
  loading: boolean;
  onRefresh: () => void;
  onSaved: () => void;
  revealed: Record<string, boolean>;
  toggleReveal: (k: string) => void;
}

interface ModelOption { id: string; label: string; tier?: string }
interface ModelsResponse { providers: Record<string, ModelOption[]> }

export function SecretsEditor({ secrets, loaded, loading, onRefresh, onSaved, revealed, toggleReveal }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Hydrate drafts whenever fresh secrets arrive
  useEffect(() => {
    if (loaded) {
      const seeded: Record<string, string> = {};
      EDITABLE_FIELDS.forEach(f => { seeded[f.key] = secrets[f.key] ?? ''; });
      setDrafts(seeded);
    }
  }, [loaded, secrets]);

  // Fetch model presets once
  useEffect(() => {
    const base = process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    fetch(`${base}/api/models`).then(r => r.json()).then(setModels).catch(() => {});
  }, []);

  const update = useCallback((k: string, v: string) => {
    setDrafts(d => ({ ...d, [k]: v }));
  }, []);

  const dirty = EDITABLE_FIELDS.some(f => (drafts[f.key] ?? '') !== (secrets[f.key] ?? ''));

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const base = process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const changed: Record<string, string> = {};
      EDITABLE_FIELDS.forEach(f => {
        if ((drafts[f.key] ?? '') !== (secrets[f.key] ?? '')) changed[f.key] = drafts[f.key] ?? '';
      });
      const r = await fetch(`${base}/api/functions/v1/set-secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secrets: changed }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'save failed');
      setSavedAt(Date.now());
      onSaved();
    } catch (e: any) {
      setErr(e?.message || 'save failed');
    } finally {
      setSaving(false);
    }
  }, [drafts, secrets, onSaved]);

  const currentProvider = drafts['DEFAULT_LLM_PROVIDER'] || secrets['DEFAULT_LLM_PROVIDER'] || 'anthropic';
  const providerModels: ModelOption[] = models?.providers?.[currentProvider] || [];

  if (!loaded) {
    return (
      <Pressable
        style={({ pressed }) => [styles.fetchBtn, pressed && { opacity: 0.7 }, loading && { opacity: 0.5 }]}
        onPress={onRefresh}
        disabled={loading}
        testID="fetch-secrets-btn"
      >
        {loading ? <ActivityIndicator size="small" color={ACCENT} /> : <MaterialIcons name="cloud-download" size={14} color={ACCENT} />}
        <Text style={styles.fetchBtnText}>{loading ? 'FETCHING...' : 'FETCH CURRENT VALUES TO EDIT'}</Text>
      </Pressable>
    );
  }

  return (
    <>
      {EDITABLE_FIELDS.map(f => {
        const draft = drafts[f.key] ?? '';
        const orig  = secrets[f.key] ?? '';
        const hasChange = draft !== orig;
        const isRevealed = !f.sensitive || revealed[f.key];
        return (
          <View key={f.key} style={[styles.card, hasChange && styles.cardDirty]}>
            <View style={styles.cardTop}>
              <View style={styles.catBadge}>
                <Text style={styles.catText}>{f.category}</Text>
              </View>
              {hasChange && (
                <View style={styles.dirtyBadge}>
                  <View style={styles.dirtyDot} />
                  <Text style={styles.dirtyText}>UNSAVED</Text>
                </View>
              )}
              {f.sensitive && (
                <Pressable onPress={() => toggleReveal(f.key)} hitSlop={8} style={styles.revealBtn}>
                  <MaterialIcons name={isRevealed ? 'visibility-off' : 'visibility'} size={12} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Text style={styles.fieldKey}>{f.key}</Text>
            <Text style={styles.fieldLabel}>{f.label}</Text>

            {/* Provider picker */}
            {f.isProvider && models ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {Object.keys(models.providers || {}).map(p => (
                  <Pressable
                    key={p}
                    onPress={() => update(f.key, p)}
                    style={[styles.chip, draft === p && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, draft === p && styles.chipTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Model picker — driven by current provider */}
            {f.isModel && providerModels.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {providerModels.map(m => (
                  <Pressable
                    key={m.id}
                    onPress={() => update(f.key, m.id)}
                    style={[styles.chip, draft === m.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, draft === m.id && styles.chipTextActive]}>{m.label}</Text>
                    {m.tier ? <Text style={styles.chipTier}>{m.tier}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={[styles.inputWrap, hasChange && styles.inputWrapDirty]}>
              <TextInput
                style={styles.input}
                value={isRevealed ? draft : draft.replace(/./g, '•')}
                onChangeText={(v) => update(f.key, v)}
                placeholder={`(empty — set ${f.key})`}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false /* we mask manually so paste still works when revealed */}
                editable={isRevealed}
                testID={`edit-${f.key}`}
              />
              {draft ? (
                <Pressable onPress={() => update(f.key, '')} hitSlop={8} style={styles.clearBtn}>
                  <MaterialIcons name="close" size={12} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={styles.saveRow}>
        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="refresh" size={13} color={Colors.textMuted} />
          <Text style={styles.refreshBtnText}>REFRESH</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!dirty || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            (!dirty || saving) && styles.saveBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          testID="save-secrets-btn"
        >
          {saving
            ? <ActivityIndicator size="small" color={Colors.bg} />
            : <MaterialIcons name={savedAt && !dirty ? 'check' : 'save'} size={14} color={Colors.bg} />}
          <Text style={styles.saveBtnText}>
            {saving ? 'SAVING...' : savedAt && !dirty ? 'SAVED' : `SAVE ${dirty ? `(${EDITABLE_FIELDS.filter(f => (drafts[f.key]??'') !== (secrets[f.key]??'')).length})` : ''}`}
          </Text>
        </Pressable>
      </View>
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  fetchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: Spacing.md, marginVertical: Spacing.sm,
    borderRadius: Radius.xl, borderWidth: 1.5, borderColor: ACCENT + '55',
    backgroundColor: ACCENT + '11', borderStyle: 'dashed',
  },
  fetchBtnText: { color: ACCENT, fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 2 },

  card: {
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated,
    padding: Spacing.sm,
    gap: 6,
  },
  cardDirty: { borderColor: ACCENT + '88', backgroundColor: ACCENT + '08' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full,
    borderWidth: 1, borderColor: ACCENT + '33', backgroundColor: ACCENT + '0a',
  },
  catText: { color: ACCENT, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.2 },
  dirtyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  dirtyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  dirtyText: { color: ACCENT, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1 },
  revealBtn: { padding: 4, marginLeft: 'auto' },

  fieldKey: {
    color: Colors.textPrimary, fontSize: 11, fontWeight: Typography.bold,
    fontFamily: MONO, letterSpacing: 0.5,
  },
  fieldLabel: { color: Colors.textMuted, fontSize: 10 },

  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: ACCENT + '88', backgroundColor: ACCENT + '14' },
  chipText: { color: Colors.textMuted, fontSize: 10, fontWeight: Typography.bold, fontFamily: MONO },
  chipTextActive: { color: ACCENT },
  chipTier: { color: Colors.textMuted, fontSize: 8, marginLeft: 2, fontFamily: MONO },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.bg,
  },
  inputWrapDirty: { borderColor: ACCENT + '66' },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 11,
    fontFamily: MONO,
    paddingVertical: Platform.OS === 'web' ? 6 : 2,
  },
  clearBtn: { padding: 4 },

  saveRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.md },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  refreshBtnText: { color: Colors.textMuted, fontSize: 10, fontWeight: Typography.bold, letterSpacing: 1.5 },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.md, borderRadius: Radius.xl,
    backgroundColor: ACCENT, borderWidth: 1, borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 10,
  },
  saveBtnDisabled: { backgroundColor: Colors.surfaceElevated, borderColor: Colors.surfaceBorder, shadowOpacity: 0 },
  saveBtnText: { color: Colors.bg, fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 1.5 },
  err: { color: Colors.danger, fontSize: 10, marginTop: 4, fontFamily: MONO },
});
