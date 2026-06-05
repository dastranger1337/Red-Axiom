/**
 * FILES — Data & Source Browser
 * Categories: Logs · Attacks · Knowledge Base · Zero-Days · Data · Source Code
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  Modal, ScrollView, Platform, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { loadAttacks, SavedAttack } from '@/services/attackStorage';
import { loadExecLog, ExecLogEntry, exportExecLog } from '@/services/executionLog';
import { loadKnowledgeBase, KnowledgeEntry } from '@/services/selfUpdateService';

// ── Source file manifest ────────────────────────────────────────────────────────
interface SourceFile { path: string; description: string; category: string; size: string }

const SOURCE_FILES: SourceFile[] = [
  // App screens
  { path: 'app/_layout.tsx',            description: 'Root layout — providers, navigation stack',              category: 'Screens', size: '~1KB'  },
  { path: 'app/(tabs)/_layout.tsx',     description: 'Tab navigator — 5 main tabs',                            category: 'Screens', size: '~1KB'  },
  { path: 'app/(tabs)/index.tsx',       description: 'CHAT screen — AI assistant interface',                   category: 'Screens', size: '~15KB' },
  { path: 'app/(tabs)/ops.tsx',         description: 'OPS hub — Attacks, Arsenal, Executor, Log',              category: 'Screens', size: '~30KB' },
  { path: 'app/(tabs)/intel.tsx',       description: 'INTEL hub — MITRE Matrix, Tools, Playbooks',             category: 'Screens', size: '~20KB' },
  { path: 'app/(tabs)/files.tsx',       description: 'FILES browser — Data & source viewer (this screen)',     category: 'Screens', size: '~12KB' },
  { path: 'app/(tabs)/config.tsx',      description: 'CONFIG — AI model, system prompt, self-update',          category: 'Screens', size: '~18KB' },
  // Services
  { path: 'services/aiService.ts',      description: 'AI chat service — message routing, streaming',           category: 'Services', size: '~4KB' },
  { path: 'services/attackStorage.ts',  description: 'Attack registry CRUD — AsyncStorage persistence',        category: 'Services', size: '~3KB' },
  { path: 'services/executionLog.ts',   description: 'Ops log service — append, delete, export, stats',        category: 'Services', size: '~3KB' },
  { path: 'services/sessionStorage.ts', description: 'Chat session persistence — save, restore, delete',       category: 'Services', size: '~2KB' },
  { path: 'services/selfUpdateService.ts','description': 'Self-update engine — prompts, KB, model config',     category: 'Services', size: '~4KB' },
  // Hooks
  { path: 'hooks/useChat.ts',           description: 'Chat logic — send, receive, session management',          category: 'Hooks', size: '~4KB'   },
  { path: 'hooks/useChatContext.ts',     description: 'Chat context consumer hook',                             category: 'Hooks', size: '~1KB'   },
  // Contexts
  { path: 'contexts/ChatContext.tsx',   description: 'Global chat state provider',                             category: 'Contexts', size: '~2KB' },
  // Components
  { path: 'components/chat/MessageBubble.tsx', description: 'Chat message rendering — markdown, code',         category: 'Components', size: '~3KB' },
  { path: 'components/chat/QuickActions.tsx',  description: 'Quick action buttons for chat',                   category: 'Components', size: '~2KB' },
  { path: 'components/chat/StealthMeter.tsx',  description: 'Operational stealth score display',               category: 'Components', size: '~2KB' },
  { path: 'components/chat/TTPTracker.tsx',    description: 'TTP detection tracker panel',                     category: 'Components', size: '~2KB' },
  { path: 'components/ui/SeverityBadge.tsx',   description: 'Severity indicator badge component',              category: 'Components', size: '~1KB' },
  { path: 'components/ui/Tag.tsx',             description: 'Tag/label UI component',                          category: 'Components', size: '~1KB' },
  // Constants
  { path: 'constants/theme.ts',         description: 'Design system — colors, typography, spacing, shadows',   category: 'Constants', size: '~3KB' },
  { path: 'constants/mitre.ts',         description: 'MITRE ATT&CK tactics & techniques database',             category: 'Constants', size: '~20KB'},
  { path: 'constants/prompts.ts',       description: 'Playbook prompt templates library',                      category: 'Constants', size: '~8KB' },
  // Edge functions
  { path: 'supabase/functions/axiom-chat/index.ts', description: 'Axiom AI edge function — chat endpoint',    category: 'Backend', size: '~4KB'  },
  { path: 'supabase/functions/_shared/cors.ts',     description: 'CORS headers for edge functions',           category: 'Backend', size: '~1KB'  },
];

const SOURCE_CATS = ['All','Screens','Services','Hooks','Contexts','Components','Constants','Backend'];

// ── Folder definitions ──────────────────────────────────────────────────────────
interface Folder { id: string; label: string; icon: string; color: string; description: string }

const FOLDERS: Folder[] = [
  { id: 'logs',     label: 'Ops Logs',        icon: 'history',      color: '#00ff41', description: 'All command, attack, and analysis execution records' },
  { id: 'attacks',  label: 'Attacks',          icon: 'bug-report',   color: '#ff2222', description: 'Registered vulnerabilities, CVEs, and zero-days' },
  { id: 'zerodays', label: 'Zero-Days',        icon: 'warning',      color: '#ff2222', description: 'Critical zero-day vulnerabilities only' },
  { id: 'known',    label: 'Known CVEs',       icon: 'verified',     color: '#ff8800', description: 'Known CVE and technique entries' },
  { id: 'kb',       label: 'Knowledge Base',   icon: 'library-books',color: '#3399ff', description: 'AI knowledge entries, techniques, and learned data' },
  { id: 'source',   label: 'Source Code',      icon: 'code',         color: Colors.accent, description: 'All application source files and modules' },
];

export default function FilesScreen() {
  const insets = useSafeAreaInsets();

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [attacks, setAttacks] = useState<SavedAttack[]>([]);
  const [logs, setLogs] = useState<ExecLogEntry[]>([]);
  const [kb, setKb] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemType, setSelectedItemType] = useState<'log'|'attack'|'kb'|'source'|null>(null);
  const [sourceCat, setSourceCat] = useState('All');
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [a, l, k] = await Promise.all([loadAttacks(), loadExecLog(), loadKnowledgeBase()]);
    setAttacks(a); setLogs(l); setKb(k);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, []);

  const zeroDays = attacks.filter(a => a.type === 'zero-day');
  const knownCVEs = attacks.filter(a => a.type === 'known-cve' || a.cve);

  const folderCount = (id: string) => {
    switch (id) {
      case 'logs': return logs.length;
      case 'attacks': return attacks.length;
      case 'zerodays': return zeroDays.length;
      case 'known': return knownCVEs.length;
      case 'kb': return kb.length;
      case 'source': return SOURCE_FILES.length;
      default: return 0;
    }
  };

  const handleExportLogs = useCallback(async () => {
    setIsExporting(true);
    try { const c = await exportExecLog(); await Share.share({ message: c, title: 'AXIOM Ops Log' }); } catch {}
    setIsExporting(false);
  }, []);

  const formatTime = (d: Date | string) => new Date(d).toLocaleDateString() + ' ' + new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const filteredSource = sourceCat === 'All' ? SOURCE_FILES : SOURCE_FILES.filter(f => f.category === sourceCat);

  // ── Render folder content ──────────────────────────────────────────────────
  const renderFolderContent = () => {
    if (!activeFolder) return null;
    const folder = FOLDERS.find(f => f.id === activeFolder);
    if (!folder) return null;

    return (
      <View style={styles.flex}>
        {/* Back header */}
        <Pressable style={styles.backRow} onPress={() => setActiveFolder(null)}>
          <MaterialIcons name="arrow-back" size={18} color={Colors.textSecondary} />
          <Text style={styles.backText}>Files</Text>
          <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
          <MaterialIcons name={folder.icon as any} size={14} color={folder.color} />
          <Text style={[styles.backCurrent, { color: folder.color }]}>{folder.label}</Text>
          {activeFolder === 'logs' && logs.length > 0 ? (
            <Pressable style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.7 }]} onPress={handleExportLogs} disabled={isExporting}>
              {isExporting ? <ActivityIndicator size="small" color={Colors.accent} /> : <MaterialIcons name="upload" size={14} color={Colors.accent} />}
              <Text style={styles.exportBtnText}>EXPORT</Text>
            </Pressable>
          ) : null}
        </Pressable>

        {isLoading ? (
          <View style={styles.empty}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <>
            {/* LOGS */}
            {activeFolder === 'logs' && (
              <FlatList
                data={logs}
                keyExtractor={e => e.id}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={() => <View style={styles.empty}><MaterialIcons name="history-toggle-off" size={48} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No logs yet</Text></View>}
                renderItem={({ item }) => (
                  <Pressable style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.8 }]} onPress={() => { setSelectedItem(item); setSelectedItemType('log'); }}>
                    <View style={[styles.fileIcon, { backgroundColor: '#00ff4115', borderColor: '#00ff4133' }]}><MaterialIcons name="terminal" size={16} color="#00ff41" /></View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{item.command.slice(0, 50)}</Text>
                      <View style={styles.fileMeta}>
                        <Text style={[styles.fileType, { color: item.isError ? Colors.danger : Colors.accent }]}>{item.type.toUpperCase()}</Text>
                        {item.target ? <Text style={[styles.fileType, { color: Colors.warning }]}>{item.target}</Text> : null}
                        <Text style={styles.fileTime}>{formatTime(item.timestamp)}</Text>
                      </View>
                    </View>
                    {item.isError ? <View style={[styles.errDot, { backgroundColor: Colors.danger }]} /> : null}
                  </Pressable>
                )}
              />
            )}

            {/* ATTACKS (all) */}
            {(activeFolder === 'attacks' || activeFolder === 'zerodays' || activeFolder === 'known') && (() => {
              const data = activeFolder === 'zerodays' ? zeroDays : activeFolder === 'known' ? knownCVEs : attacks;
              const sevColors: Record<string,string> = { info: '#3399ff', low: '#00cc44', medium: '#ffaa00', high: '#ff6600', critical: '#ff2222' };
              return (
                <FlatList
                  data={data}
                  keyExtractor={a => a.id}
                  contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={() => <View style={styles.empty}><MaterialIcons name="bug-report" size={48} color={Colors.textMuted} /><Text style={styles.emptyTitle}>No entries</Text></View>}
                  renderItem={({ item }) => {
                    const c = sevColors[item.severity] || Colors.textMuted;
                    return (
                      <Pressable style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.8 }]} onPress={() => { setSelectedItem(item); setSelectedItemType('attack'); }}>
                        <View style={[styles.fileIcon, { backgroundColor: c+'15', borderColor: c+'33' }]}><MaterialIcons name="bug-report" size={16} color={c} /></View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                          <View style={styles.fileMeta}>
                            {item.cve ? <Text style={[styles.fileType, { color: Colors.warning }]}>{item.cve}</Text> : null}
                            <View style={[styles.miniTag, { borderColor: c+'55', backgroundColor: c+'11' }]}><Text style={[styles.miniTagText, { color: c }]}>{item.severity.toUpperCase()}</Text></View>
                            <Text style={styles.fileTime}>{formatTime(item.discoveredAt)}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  }}
                />
              );
            })()}

            {/* KNOWLEDGE BASE */}
            {activeFolder === 'kb' && (
              <FlatList
                data={kb}
                keyExtractor={e => e.id}
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={() => <View style={styles.empty}><MaterialIcons name="library-books" size={48} color={Colors.textMuted} /><Text style={styles.emptyTitle}>Knowledge base empty</Text><Text style={styles.emptySub}>Run self-update in Config to populate</Text></View>}
                renderItem={({ item }) => (
                  <Pressable style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.8 }]} onPress={() => { setSelectedItem(item); setSelectedItemType('kb'); }}>
                    <View style={[styles.fileIcon, { backgroundColor: Colors.info+'15', borderColor: Colors.info+'33' }]}><MaterialIcons name="library-books" size={16} color={Colors.info} /></View>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{item.title}</Text>
                      <View style={styles.fileMeta}>
                        <Text style={styles.fileType}>{item.category}</Text>
                        <View style={[styles.miniTag, { borderColor: item.source==='ai-generated'?Colors.accent+'44':Colors.textMuted+'33', backgroundColor: item.source==='ai-generated'?Colors.accentMuted:Colors.surfaceElevated }]}>
                          <Text style={[styles.miniTagText, { color: item.source==='ai-generated'?Colors.accent:Colors.textMuted }]}>{item.source==='ai-generated'?'AI':'MANUAL'}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            )}

            {/* SOURCE CODE */}
            {activeFolder === 'source' && (
              <View style={styles.flex}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {SOURCE_CATS.map(cat => (
                    <Pressable key={cat} style={[styles.chip, sourceCat===cat && styles.chipActive]} onPress={() => setSourceCat(cat)}>
                      <Text style={[styles.chipText, sourceCat===cat && { color: Colors.primary }]}>{cat}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <FlatList
                  data={filteredSource}
                  keyExtractor={f => f.path}
                  contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <Pressable style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.8 }]} onPress={() => { setSelectedItem(item); setSelectedItemType('source'); }}>
                      <View style={[styles.fileIcon, { backgroundColor: Colors.accentMuted, borderColor: Colors.accent+'33' }]}>
                        <MaterialIcons name="insert-drive-file" size={16} color={Colors.accent} />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileName} numberOfLines={1}>{item.path.split('/').pop()}</Text>
                        <Text style={styles.filePathText} numberOfLines={1}>{item.path}</Text>
                        <View style={styles.fileMeta}>
                          <View style={[styles.miniTag, { borderColor: Colors.info+'33', backgroundColor: Colors.info+'0d' }]}><Text style={[styles.miniTagText, { color: Colors.info }]}>{item.category}</Text></View>
                          <Text style={styles.fileSize}>{item.size}</Text>
                        </View>
                      </View>
                      <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                    </Pressable>
                  )}
                />
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  // ── Detail modal content ───────────────────────────────────────────────────
  const renderModalContent = () => {
    if (!selectedItem || !selectedItemType) return null;

    if (selectedItemType === 'log') {
      const item = selectedItem as ExecLogEntry;
      const cfg = { command: { color: '#00ff41', icon: 'terminal' }, analysis: { color: '#3399ff', icon: 'security' }, chat: { color: '#aa44ff', icon: 'chat' }, attack: { color: '#ff2222', icon: 'flash-on' }, recon: { color: '#ffaa00', icon: 'radar' }, exploit: { color: '#ff6600', icon: 'bug-report' } }[item.type] || { color: Colors.accent, icon: 'code' };
      return (
        <>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.miniTag, { borderColor: cfg.color+'55', backgroundColor: cfg.color+'11' }]}><MaterialIcons name={cfg.icon as any} size={10} color={cfg.color} /><Text style={[styles.miniTagText, { color: cfg.color }]}>{item.type.toUpperCase()}</Text></View>
            <View style={styles.mhRight}><Pressable onPress={async () => { try { await Share.share({ message: `${item.command}\n\n${item.output}` }); } catch {} }} hitSlop={8}><MaterialIcons name="share" size={18} color={Colors.textMuted} /></Pressable><Pressable onPress={() => setSelectedItem(null)} hitSlop={8}><MaterialIcons name="close" size={20} color={Colors.textMuted} /></Pressable></View>
          </View>
          <Text style={styles.detailTime}>{formatTime(item.timestamp)}{item.target ? ` · ${item.target}` : ''}{item.durationMs ? ` · ${item.durationMs}ms` : ''}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>COMMAND</Text>
            <View style={[styles.codeBlock, { borderColor: cfg.color+'33' }]}><Text style={[styles.codeText, { color: cfg.color }]}>{item.command}</Text></View>
            <Text style={styles.sectionLabel}>OUTPUT</Text>
            <View style={[styles.codeBlock, item.isError && { borderColor: Colors.danger+'44' }]}><Text style={[styles.codeText, { color: item.isError?Colors.danger:Colors.accent }]}>{item.output||'(no output)'}</Text></View>
          </ScrollView>
        </>
      );
    }

    if (selectedItemType === 'attack') {
      const item = selectedItem as SavedAttack;
      const sevColors: Record<string,string> = { info: '#3399ff', low: '#00cc44', medium: '#ffaa00', high: '#ff6600', critical: '#ff2222' };
      const c = sevColors[item.severity]||Colors.textMuted;
      return (
        <>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.miniTag, { borderColor: c+'55', backgroundColor: c+'11' }]}><Text style={[styles.miniTagText, { color: c }]}>{item.severity.toUpperCase()}</Text></View>
            <Pressable onPress={() => setSelectedItem(null)} hitSlop={8}><MaterialIcons name="close" size={20} color={Colors.textMuted} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{item.title}</Text>
            {item.cve ? <Text style={[styles.detailTime, { color: Colors.warning }]}>{item.cve}</Text> : null}
            {item.mitreId ? <Text style={[styles.detailTime, { color: Colors.accent }]}>{item.mitreId}</Text> : null}
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.bodyText}>{item.description}</Text>
            {item.proofOfConcept ? <><Text style={styles.sectionLabel}>PROOF OF CONCEPT</Text><View style={styles.codeBlock}><Text style={[styles.codeText, { color: Colors.accent }]}>{item.proofOfConcept}</Text></View></> : null}
            {item.notes ? <><Text style={styles.sectionLabel}>NOTES</Text><Text style={styles.bodyText}>{item.notes}</Text></> : null}
            <Text style={styles.detailTime}>Discovered: {formatTime(item.discoveredAt)}</Text>
          </ScrollView>
        </>
      );
    }

    if (selectedItemType === 'kb') {
      const item = selectedItem as KnowledgeEntry;
      return (
        <>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.miniTag, { borderColor: Colors.info+'44', backgroundColor: Colors.info+'0d' }]}><Text style={[styles.miniTagText, { color: Colors.info }]}>{item.category}</Text></View>
            <Pressable onPress={() => setSelectedItem(null)} hitSlop={8}><MaterialIcons name="close" size={20} color={Colors.textMuted} /></Pressable>
          </View>
          <Text style={styles.modalTitle}>{item.title}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.bodyText}>{item.content}</Text>
            <Text style={styles.detailTime}>Source: {item.source}</Text>
          </ScrollView>
        </>
      );
    }

    if (selectedItemType === 'source') {
      const item = selectedItem as SourceFile;
      return (
        <>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.miniTag, { borderColor: Colors.info+'33', backgroundColor: Colors.info+'0d' }]}><Text style={[styles.miniTagText, { color: Colors.info }]}>{item.category}</Text></View>
            <Pressable onPress={() => setSelectedItem(null)} hitSlop={8}><MaterialIcons name="close" size={20} color={Colors.textMuted} /></Pressable>
          </View>
          <Text style={styles.modalTitle}>{item.path.split('/').pop()}</Text>
          <View style={styles.codeBlock}><Text style={[styles.codeText, { color: Colors.accent }]}>{item.path}</Text></View>
          <Text style={styles.bodyText}>{item.description}</Text>
          <View style={styles.sourceInfoRow}>
            <View style={styles.sourceInfoItem}><Text style={styles.sectionLabel}>CATEGORY</Text><Text style={styles.bodyText}>{item.category}</Text></View>
            <View style={styles.sourceInfoItem}><Text style={styles.sectionLabel}>SIZE</Text><Text style={styles.bodyText}>{item.size}</Text></View>
          </View>
          <View style={[styles.codeBlock, { backgroundColor: Colors.surface+'80' }]}>
            <Text style={styles.sectionLabel}>MODIFY VIA CHAT</Text>
            <Text style={styles.bodyText}>Ask AXIOM AI to modify this file: "Edit {item.path.split('/').pop()} to ..."</Text>
          </View>
        </>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>FILES</Text>
          <Text style={styles.headerSub}>{logs.length} logs · {attacks.length} attacks · {kb.length} KB entries</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]} onPress={loadData}>
          <MaterialIcons name="refresh" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {activeFolder ? renderFolderContent() : (
        /* ── Folder grid ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.folderGrid, { paddingBottom: insets.bottom + 110 }]}>
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            {[
              { label: 'Total Logs', value: logs.length, color: '#00ff41', icon: 'history' },
              { label: 'Errors', value: logs.filter(l=>l.isError).length, color: Colors.danger, icon: 'error-outline' },
              { label: 'Attacks', value: attacks.length, color: '#ff2222', icon: 'bug-report' },
              { label: 'KB Items', value: kb.length, color: Colors.info, icon: 'library-books' },
            ].map(s => (
              <View key={s.label} style={styles.summaryCard}>
                <MaterialIcons name={s.icon as any} size={18} color={s.color} />
                <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeader}>DATA STORES</Text>
          <View style={styles.folderCardGrid}>
            {FOLDERS.filter(f => f.id !== 'source').map(folder => (
              <Pressable key={folder.id} style={({ pressed }) => [styles.folderCard, pressed && { opacity: 0.75 }]} onPress={() => setActiveFolder(folder.id)}>
                <View style={[styles.folderCardIcon, { backgroundColor: folder.color+'18', borderColor: folder.color+'33' }]}>
                  <MaterialIcons name={folder.icon as any} size={26} color={folder.color} />
                </View>
                <Text style={styles.folderCardName}>{folder.label}</Text>
                <View style={styles.folderCardCount}>
                  <Text style={[styles.folderCardCountNum, { color: folder.color }]}>{folderCount(folder.id)}</Text>
                  <Text style={styles.folderCardCountLabel}>items</Text>
                </View>
                <Text style={styles.folderCardDesc} numberOfLines={2}>{folder.description}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionHeader}>SOURCE CODE</Text>
          <Pressable style={({ pressed }) => [styles.sourceBanner, pressed && { opacity: 0.85 }]} onPress={() => setActiveFolder('source')}>
            <View style={[styles.folderCardIcon, { backgroundColor: Colors.accentMuted, borderColor: Colors.accent+'33', width: 48, height: 48 }]}>
              <MaterialIcons name="code" size={24} color={Colors.accent} />
            </View>
            <View style={styles.sourceBannerInfo}>
              <Text style={styles.folderCardName}>Application Source</Text>
              <Text style={styles.folderCardDesc}>{SOURCE_FILES.length} files across {SOURCE_CATS.length - 1} categories</Text>
              <Text style={[styles.folderCardDesc, { color: Colors.accent, marginTop: 2 }]}>Screens · Services · Hooks · Components · Backend</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={selectedItem !== null} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            {renderModalContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold, letterSpacing: 3 },
  headerSub: { color: Colors.textMuted, fontSize: Typography.xs, marginTop: 2 },
  refreshBtn: { padding: Spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder, backgroundColor: Colors.bgSecondary },
  backText: { color: Colors.textSecondary, fontSize: Typography.sm },
  backCurrent: { fontSize: Typography.sm, fontWeight: Typography.semibold, flex: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accentMuted, borderWidth: 1, borderColor: Colors.accent+'44', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  exportBtnText: { color: Colors.accent, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1 },
  folderGrid: { padding: Spacing.base, gap: Spacing.base },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center', gap: 4 },
  summaryValue: { fontSize: Typography.lg, fontWeight: Typography.bold },
  summaryLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, textAlign: 'center' },
  sectionHeader: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 2, marginBottom: Spacing.xs },
  folderCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  folderCard: { width: '48%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.xl, padding: Spacing.base, gap: Spacing.xs },
  folderCardIcon: { width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  folderCardName: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.semibold },
  folderCardCount: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  folderCardCountNum: { fontSize: Typography.xl, fontWeight: Typography.bold },
  folderCardCountLabel: { color: Colors.textMuted, fontSize: Typography.xs },
  folderCardDesc: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  sourceBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.xl, padding: Spacing.base },
  sourceBannerInfo: { flex: 1 },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xs, gap: Spacing.sm },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, padding: Spacing.base },
  fileIcon: { width: 36, height: 36, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  fileInfo: { flex: 1 },
  fileName: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.medium, marginBottom: 3 },
  filePathText: { color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Platform.OS==='ios'?'Menlo':'monospace', marginBottom: 4 },
  fileMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  fileType: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5 },
  fileTime: { color: Colors.textMuted, fontSize: 9, marginLeft: 'auto' },
  fileSize: { color: Colors.textMuted, fontSize: 9, marginLeft: 'auto' },
  errDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface },
  chipActive: { borderColor: Colors.primary+'55', backgroundColor: Colors.primaryMuted },
  chipText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.medium },
  miniTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated },
  miniTagText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.textMuted, letterSpacing: 0.3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: Spacing.xxxl },
  emptyTitle: { color: Colors.textSecondary, fontSize: Typography.lg, fontWeight: Typography.semibold },
  emptySub: { color: Colors.textMuted, fontSize: Typography.sm, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: Spacing.base, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.base },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  mhRight: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  modalTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, marginBottom: Spacing.sm },
  detailTime: { color: Colors.textMuted, fontSize: Typography.xs, fontFamily: Platform.OS==='ios'?'Menlo':'monospace', marginBottom: Spacing.sm },
  sectionLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  bodyText: { color: Colors.textSecondary, fontSize: Typography.base, lineHeight: 22, marginBottom: Spacing.sm },
  codeBlock: { backgroundColor: '#000', borderWidth: 1, borderColor: Colors.accent+'22', borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.sm },
  codeText: { fontFamily: Platform.OS==='ios'?'Menlo':'monospace', fontSize: 12, lineHeight: 20, color: Colors.accent },
  sourceInfoRow: { flexDirection: 'row', gap: Spacing.base, marginBottom: Spacing.sm },
  sourceInfoItem: { flex: 1 },
});
