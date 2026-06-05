/**
 * INTEL — Intelligence Hub
 * Combines: MITRE ATT&CK Matrix · Tools/Modules · Playbooks
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, FlatList, Dimensions, ActivityIndicator, Share, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useChatContext } from '@/hooks/useChatContext';
import { MITRE_TACTICS, MITRE_TECHNIQUES, MitreTactic, MitreTechnique } from '@/constants/mitre';
import { PROMPT_TEMPLATES, CATEGORIES, PromptTemplate, PromptCategory } from '@/constants/prompts';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
type IntelTab = 'matrix' | 'tools' | 'plays';

// ── Tools data ─────────────────────────────────────────────────────────────────
interface ToolItem { id: string; name: string; description: string; icon: string; color: string; category: string; prompt: string; tags: string[] }

const TOOLS: ToolItem[] = [
  { id: 't1',  name: 'Attack Surface Map',    description: 'Full external attack surface enumeration and prioritization',  icon: 'radar',           color: '#ff2222', category: 'Exploitation',       tags: ['recon','external'],    prompt: 'Generate a comprehensive external attack surface analysis: exposed services, web entry points, API endpoints, authentication mechanisms, and prioritized vulnerability targets with scoring matrix.' },
  { id: 't2',  name: 'SQLi Chain Builder',     description: 'Multi-stage SQL injection exploitation chains',                icon: 'data-array',      color: '#ff4400', category: 'Exploitation',       tags: ['web','sqli'],          prompt: 'Build a complete SQL injection chain from detection to OS command execution: error-based, blind, time-based, WAF bypass, and data extraction to RCE escalation.' },
  { id: 't3',  name: 'Buffer Overflow',         description: 'Stack/heap overflow, ROP chains, shellcode',                  icon: 'memory',          color: '#ff6600', category: 'Exploitation',       tags: ['binary','rop'],        prompt: 'Explain buffer overflow exploitation from fuzzing to working exploit: offset finding, bad char analysis, shellcode, ROP chains for ASLR/DEP bypass with pwntools examples.' },
  { id: 't4',  name: 'AD Attack Chains',        description: 'Active Directory full compromise path planning',              icon: 'account-tree',    color: '#cc2222', category: 'Exploitation',       tags: ['ad','windows'],        prompt: 'Build complete AD compromise: BloodHound, Kerberoasting, ACL abuse, Pass-the-Hash/Ticket, DCSync, Golden Ticket, forest trust attacks.' },
  { id: 't5',  name: 'Cloud Exploitation',      description: 'AWS/Azure/GCP attack paths and privilege escalation',         icon: 'cloud-done',      color: '#ff2266', category: 'Exploitation',       tags: ['cloud','aws'],         prompt: 'Cloud exploitation: AWS IAM privilege escalation, Azure AD PRT theft, GCP service account impersonation, IMDS token theft, S3 bucket misconfigurations.' },
  { id: 't6',  name: 'Network Pivot Matrix',    description: 'Multi-hop pivoting through segmented networks',               icon: 'device-hub',      color: '#3399ff', category: 'Network',            tags: ['pivot','tunnel'],      prompt: 'Network pivoting guide: SSH tunnels, SOCKS proxies, chisel, ligolo-ng, Metasploit routing, double pivots, DMZ to internal movement.' },
  { id: 't7',  name: 'C2 Architecture',         description: 'Resilient multi-tier C2 infrastructure design',               icon: 'router',          color: '#aa44ff', category: 'Network',            tags: ['c2','infrastructure'], prompt: 'Resilient C2 infrastructure: redirectors, domain fronting, CDN abuse, malleable profiles, JA3 evasion, DNS-over-HTTPS C2.' },
  { id: 't8',  name: 'Persistence Arsenal',     description: 'Full persistence toolkit: Windows, Linux, macOS',             icon: 'settings-backup-restore', color: '#ff8800', category: 'Post-Exploit', tags: ['persistence'],         prompt: 'Persistence mechanisms: Windows (registry, services, WMI, COM hijacking), Linux (cron, systemd, LD_PRELOAD), macOS (LaunchAgents, plist, dylib hijack).' },
  { id: 't9',  name: 'Privilege Escalation',    description: 'Local privesc across all platforms',                          icon: 'arrow-upward',    color: '#ffaa00', category: 'Post-Exploit',       tags: ['privesc'],             prompt: 'Full privilege escalation: Windows (token impersonation, UAC bypass, Potato attacks), Linux (SUID, sudo misconfig, kernel exploits, capabilities).' },
  { id: 't10', name: 'Credential Harvesting',   description: 'Extract credentials from all sources',                        icon: 'key',             color: '#00ff41', category: 'Post-Exploit',       tags: ['credentials'],         prompt: 'Credential harvesting: Windows (LSASS, SAM, DPAPI, browser creds), Linux (/etc/shadow, SSH keys), network (Responder, Kerberoasting).' },
  { id: 't11', name: 'Container Escape',        description: 'Docker/Kubernetes breakout and cluster takeover',             icon: 'logout',          color: '#00cc88', category: 'Post-Exploit',       tags: ['docker','kubernetes'], prompt: 'Container attacks: Docker socket abuse, privileged container escape, K8s RBAC misconfiguration, etcd access, service account token theft.' },
  { id: 't12', name: 'AV/EDR Bypass',           description: 'Modern endpoint detection evasion techniques',                icon: 'visibility-off',  color: '#00ff41', category: 'Evasion',            tags: ['av','edr','amsi'],     prompt: 'AV/EDR evasion: AMSI bypass, ETW patching, direct syscalls via SysWhispers3, process injection, living-off-the-land, obfuscation techniques.' },
  { id: 't13', name: 'Traffic Obfuscation',     description: 'C2 traffic blending and network evasion',                    icon: 'blur-on',         color: '#00cc44', category: 'Evasion',            tags: ['c2','traffic'],        prompt: 'C2 traffic evasion: domain fronting, HTTP/S malleable profiles, DNS tunneling, ICMP/DNS covert channels, legitimate service abuse (GitHub, OneDrive).' },
  { id: 't14', name: 'OSINT Framework',         description: 'Comprehensive passive intelligence gathering',                icon: 'public',          color: '#3399ff', category: 'Recon',              tags: ['osint','passive'],     prompt: 'Full OSINT campaign: passive DNS, certificate transparency, ASN/IP mapping, Shodan/Censys queries, LinkedIn enumeration, GitHub secrets scanning.' },
  { id: 't15', name: 'Phishing Arsenal',        description: 'End-to-end spear phishing campaign framework',               icon: 'phishing',        color: '#ff44aa', category: 'Social Engineering', tags: ['phishing','email'],    prompt: 'Phishing infrastructure: GoPhish/EvilGinx2 setup, domain squatting, HTML smuggling, macro Office docs, LNK files, ISO delivery, MFA bypass, campaign analytics.' },
  { id: 't16', name: 'Executive Report',        description: 'Board-ready findings with business impact',                  icon: 'description',     color: '#ffcc00', category: 'Reporting',          tags: ['report','executive'],  prompt: 'Executive red team report: attack narrative, business impact, kill chain walkthrough, risk matrix, crown jewel exposure, prioritized remediation roadmap.' },
  { id: 't17', name: 'IOC Generator',           description: 'Indicators of compromise for blue team handoff',             icon: 'fingerprint',     color: '#ff8800', category: 'Reporting',          tags: ['ioc','blue-team'],     prompt: 'IOC report: file hashes, network indicators (IPs, domains, JA3), host indicators (registry, mutex), YARA rules, Sigma detection rules, STIX2 format.' },
  { id: 't18', name: 'HW Implants',             description: 'USB/PCIe/network hardware implant tradecraft',               icon: 'developer-board', color: '#ff44aa', category: 'Hardware',           tags: ['usb','implant'],       prompt: 'Hardware implants: USB HID (Rubber Ducky, O.MG cable), network taps, firmware backdoors, PCIe DMA implants, supply chain tampering, C2 channels.' },
];

const TOOL_CATS = ['All','Exploitation','Network','Post-Exploit','Evasion','Recon','Social Engineering','Reporting','Hardware'];

// ── Main ────────────────────────────────────────────────────────────────────────
export default function IntelScreen() {
  const [activeTab, setActiveTab] = useState<IntelTab>('matrix');
  const insets = useSafeAreaInsets();
  const { injectPrompt } = useChatContext();
  const router = useRouter();

  // ── MITRE state ──────────────────────────────────────────────────────────
  const [selectedTactic, setSelectedTactic] = useState<MitreTactic | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<MitreTechnique | null>(null);
  const [mitreSearch, setMitreSearch] = useState('');
  const [coverage, setCoverage] = useState<Record<string, 'none'|'queried'|'tested'|'exploited'>>({});

  const filteredTechs = useMemo(() => {
    let t = selectedTactic ? MITRE_TECHNIQUES.filter(t => t.tactics.includes(selectedTactic.id)) : MITRE_TECHNIQUES;
    if (mitreSearch.trim()) { const q = mitreSearch.toLowerCase(); t = t.filter(x => x.id.toLowerCase().includes(q)||x.name.toLowerCase().includes(q)||x.description.toLowerCase().includes(q)); }
    return t;
  }, [selectedTactic, mitreSearch]);

  const covStats = useMemo(() => {
    const total = MITRE_TECHNIQUES.length;
    const queried = Object.values(coverage).filter(v=>v!=='none').length;
    const tested = Object.values(coverage).filter(v=>v==='tested'||v==='exploited').length;
    const exploited = Object.values(coverage).filter(v=>v==='exploited').length;
    return { total, queried, tested, exploited, pct: Math.round((queried/total)*100) };
  }, [coverage]);

  const getTacticColor = useCallback((id: string) => MITRE_TACTICS.find(t=>t.id===id)?.color||Colors.primary, []);

  const handleDeepDive = useCallback((tech: MitreTechnique) => {
    setCoverage(p => ({ ...p, [tech.id]: p[tech.id]==='exploited'?'exploited':p[tech.id]==='tested'?'tested':'queried' }));
    injectPrompt(`Deep dive MITRE ATT&CK ${tech.id} - ${tech.name}\n\nProvide: real-world examples, step-by-step methodology, tools and commands, detection opportunities, and evasion tips.`);
    setSelectedTechnique(null);
    router.push('/(tabs)');
  }, [injectPrompt, router]);

  // ── Tools state ──────────────────────────────────────────────────────────
  const [toolCat, setToolCat] = useState('All');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportType, setReportType] = useState<'executive'|'technical'|'ioc'>('executive');
  const [showReport, setShowReport] = useState(false);

  const filteredTools = toolCat==='All' ? TOOLS : TOOLS.filter(t=>t.category===toolCat);

  const handleUseTool = useCallback((tool: ToolItem) => { injectPrompt(tool.prompt); router.push('/(tabs)'); }, [injectPrompt, router]);

  const generateReport = useCallback(async () => {
    setIsGenerating(true); setReportContent('');
    try {
      const prompts = {
        executive: 'Generate a professional executive red team report with: EXECUTIVE SUMMARY, ATTACK TIMELINE, TOP CRITICAL FINDINGS (business impact), RISK MATRIX, STRATEGIC RECOMMENDATIONS. Non-technical language for C-suite.',
        technical: 'Generate technical pentest findings: SCOPE, DETAILED FINDINGS with CVSSv3.1, POC steps, AFFECTED SYSTEMS, MITIGATIONS, REMEDIATION roadmap, VERIFICATION criteria.',
        ioc: 'Generate IOC report for blue team: FILE INDICATORS, NETWORK INDICATORS, HOST INDICATORS, YARA RULES, SIGMA detection rules, STIX2 format summary.',
      };
      const res = await fetch(`${process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL}/api/functions/v1/axiom-chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ messages: [{ role: 'system', content: 'You are AXIOM. Generate professional security reports. Use markdown.' }, { role: 'user', content: prompts[reportType] }], stream: false }),
      });
      const text = await res.text(); let out = '';
      for (const line of text.split('\n')) { if (line.startsWith('data: ')) { const d = line.slice(6).trim(); if (d==='[DONE]') continue; try { const p = JSON.parse(d); out += p.choices?.[0]?.delta?.content||p.choices?.[0]?.message?.content||''; } catch {} } }
      if (!out) { try { out = JSON.parse(text).choices?.[0]?.message?.content||text; } catch { out = text; } }
      setReportContent(out||'Generation failed.');
    } catch (err: any) { setReportContent(`Error: ${err?.message}`); } finally { setIsGenerating(false); }
  }, [reportType]);

  // ── Plays state ──────────────────────────────────────────────────────────
  const [playCat, setPlayCat] = useState<PromptCategory|'all'>('all');
  const [selectedPlay, setSelectedPlay] = useState<PromptTemplate|null>(null);

  const filteredPlays = playCat==='all' ? PROMPT_TEMPLATES : PROMPT_TEMPLATES.filter(p=>p.category===playCat);

  const handleUsePlay = useCallback((p: PromptTemplate) => { injectPrompt(p.prompt); setSelectedPlay(null); router.push('/(tabs)'); }, [injectPrompt, router]);

  const SEV_COLORS: Record<string,string> = { critical: Colors.danger, high: Colors.warning, medium: '#ffaa00', low: Colors.info, info: Colors.textMuted };

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'matrix' as IntelTab, label: 'ATT&CK',  icon: 'grid-view',    color: Colors.accent  },
    { id: 'tools'  as IntelTab, label: 'TOOLS',   icon: 'construction', color: Colors.warning },
    { id: 'plays'  as IntelTab, label: 'PLAYS',   icon: 'layers',       color: Colors.info    },
  ];

  const CELL_W = Math.floor((W - Spacing.base * 2 - Spacing.xs * 3) / 4);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>INTEL</Text>
        {activeTab==='matrix' && <View style={styles.covPill}><Text style={styles.covPct}>{covStats.pct}% covered</Text></View>}
        {activeTab==='tools' && <Pressable style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.8 }]} onPress={() => setShowReport(true)}><MaterialIcons name="assessment" size={13} color={Colors.bg} /><Text style={styles.reportBtnText}>REPORT</Text></Pressable>}
        {activeTab==='plays' && <Text style={styles.headerSub}>{filteredPlays.length} templates</Text>}
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[styles.subTab, activeTab===tab.id && { borderBottomColor: tab.color, borderBottomWidth: 2 }]} onPress={() => setActiveTab(tab.id)}>
            <MaterialIcons name={tab.icon as any} size={14} color={activeTab===tab.id?tab.color:Colors.textMuted} />
            <Text style={[styles.subTabText, activeTab===tab.id && { color: tab.color }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ══ MITRE MATRIX ══ */}
      {activeTab==='matrix' && (
        <View style={styles.flex}>
          {/* Coverage bar */}
          <View style={styles.covBar}>
            {[['Total', covStats.total, Colors.textSecondary], ['Queried', covStats.queried, Colors.info], ['Tested', covStats.tested, Colors.warning], ['Exploited', covStats.exploited, Colors.danger]].map(([l,v,c]) => (
              <View key={l as string} style={styles.covStat}><Text style={[styles.statValue, { color: c as string }]}>{v as number}</Text><Text style={styles.statLabel}>{l as string}</Text></View>
            ))}
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={15} color={Colors.textMuted} />
            <TextInput style={styles.searchInput} value={mitreSearch} onChangeText={setMitreSearch} placeholder="Search techniques, IDs..." placeholderTextColor={Colors.textMuted} />
            {mitreSearch ? <Pressable onPress={() => setMitreSearch('')} hitSlop={8}><MaterialIcons name="close" size={13} color={Colors.textMuted} /></Pressable> : null}
          </View>

          {/* Tactic filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {MITRE_TACTICS.map(tac => {
              const isSel = selectedTactic?.id===tac.id;
              const count = MITRE_TECHNIQUES.filter(t=>t.tactics.includes(tac.id)).length;
              return (
                <Pressable key={tac.id} style={[styles.chip, isSel && { borderColor: tac.color, backgroundColor: tac.color+'1a' }]} onPress={() => setSelectedTactic(isSel?null:tac)}>
                  <View style={[styles.chipDot, { backgroundColor: tac.color }]} />
                  <Text style={[styles.chipText, isSel && { color: tac.color }]}>{tac.shortName}</Text>
                  <Text style={[styles.chipCount, isSel && { color: tac.color }]}>{count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <FlatList
            data={filteredTechs}
            keyExtractor={t => t.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={() => <View style={styles.empty}><Text style={styles.emptyTitle}>No techniques found</Text></View>}
            renderItem={({ item }) => {
              const color = getTacticColor(item.tactics[0]);
              const cov = coverage[item.id]||'none';
              return (
                <Pressable style={({ pressed }) => [styles.techRow, pressed && { opacity: 0.75 }]} onPress={() => setSelectedTechnique(item)}>
                  <View style={[styles.techIdBadge, { borderColor: color+'55', backgroundColor: color+'11' }]}><Text style={[styles.techId, { color }]}>{item.id}</Text></View>
                  <View style={styles.techInfo}>
                    <Text style={styles.techName}>{item.name}</Text>
                    <Text style={styles.techDesc} numberOfLines={1}>{item.description}</Text>
                    <View style={styles.techMeta}>
                      {item.tactics.slice(0,2).map(tid => { const tac = MITRE_TACTICS.find(t=>t.id===tid); return tac ? <View key={tid} style={[styles.miniTag, { borderColor: tac.color+'44', backgroundColor: tac.color+'11' }]}><Text style={[styles.miniTagText, { color: tac.color }]}>{tac.shortName}</Text></View> : null; })}
                      {cov!=='none' ? <View style={[styles.miniTag, { backgroundColor: cov==='exploited'?Colors.danger+'22':cov==='tested'?Colors.warning+'22':Colors.info+'22', borderColor: cov==='exploited'?Colors.danger+'55':cov==='tested'?Colors.warning+'55':Colors.info+'55' }]}><Text style={[styles.miniTagText, { color: cov==='exploited'?Colors.danger:cov==='tested'?Colors.warning:Colors.info }]}>{cov.toUpperCase()}</Text></View> : null}
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* ══ TOOLS ══ */}
      {activeTab==='tools' && (
        <View style={styles.flex}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TOOL_CATS.map(cat => <Pressable key={cat} style={[styles.chip, toolCat===cat && styles.chipActive]} onPress={() => setToolCat(cat)}><Text style={[styles.chipText, toolCat===cat && { color: Colors.primary }]}>{cat}</Text></Pressable>)}
          </ScrollView>
          <FlatList
            data={filteredTools}
            keyExtractor={t => t.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={({ pressed }) => [styles.toolCard, pressed && { opacity: 0.75 }]} onPress={() => handleUseTool(item)}>
                <View style={[styles.toolIcon, { backgroundColor: item.color+'18', borderColor: item.color+'33' }]}>
                  <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.toolInfo}>
                  <View style={styles.toolTitleRow}>
                    <Text style={styles.toolName}>{item.name}</Text>
                    <View style={[styles.miniTag, { borderColor: item.color+'33', backgroundColor: item.color+'0d' }]}><Text style={[styles.miniTagText, { color: item.color }]}>{item.category}</Text></View>
                  </View>
                  <Text style={styles.toolDesc} numberOfLines={2}>{item.description}</Text>
                </View>
                <MaterialIcons name="send" size={14} color={Colors.textMuted} />
              </Pressable>
            )}
          />
        </View>
      )}

      {/* ══ PLAYS ══ */}
      {activeTab==='plays' && (
        <View style={styles.flex}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pressable style={[styles.chip, playCat==='all' && styles.chipActive]} onPress={() => setPlayCat('all')}><Text style={[styles.chipText, playCat==='all' && { color: Colors.primary }]}>All</Text></Pressable>
            {CATEGORIES.map(c => <Pressable key={c.id} style={[styles.chip, playCat===c.id && { borderColor: c.color, backgroundColor: c.color+'18' }]} onPress={() => setPlayCat(playCat===c.id?'all':c.id as any)}><MaterialIcons name={c.icon as any} size={11} color={playCat===c.id?c.color:Colors.textMuted} /><Text style={[styles.chipText, playCat===c.id && { color: c.color }]}>{c.label}</Text></Pressable>)}
          </ScrollView>
          <FlatList
            data={filteredPlays}
            keyExtractor={p => p.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110, gap: Spacing.md }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cat = CATEGORIES.find(c=>c.id===item.category);
              const sevColor = SEV_COLORS[item.severity]||Colors.textMuted;
              return (
                <Pressable style={({ pressed }) => [styles.playCard, pressed && { opacity: 0.75 }]} onPress={() => setSelectedPlay(item)}>
                  <View style={styles.playHeader}>
                    <View style={[styles.catDot, { backgroundColor: cat?.color||Colors.primary }]} />
                    <Text style={styles.playName} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.miniTag, { borderColor: sevColor+'55', backgroundColor: sevColor+'11' }]}><Text style={[styles.miniTagText, { color: sevColor }]}>{item.severity.toUpperCase()}</Text></View>
                  </View>
                  <Text style={styles.playDesc} numberOfLines={2}>{item.description}</Text>
                  <View style={styles.playTags}>{item.tags.slice(0,3).map(t => <View key={t} style={styles.miniTag}><Text style={styles.miniTagText}>{t}</Text></View>)}</View>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* ══ MITRE TECHNIQUE MODAL ══ */}
      <Modal visible={selectedTechnique!==null} transparent animationType="slide" onRequestClose={() => setSelectedTechnique(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedTechnique ? (() => {
              const color = getTacticColor(selectedTechnique.tactics[0]);
              const cov = coverage[selectedTechnique.id]||'none';
              return (
                <>
                  <View style={styles.modalHandle} />
                  <View style={styles.modalHeader}>
                    <View style={[styles.techIdBadge, { borderColor: color+'55', backgroundColor: color+'11' }]}><Text style={[styles.techId, { color }]}>{selectedTechnique.id}</Text></View>
                    <Pressable onPress={() => setSelectedTechnique(null)} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
                  </View>
                  <Text style={styles.modalTitle}>{selectedTechnique.name}</Text>
                  <View style={styles.badgeRow}>
                    {selectedTechnique.tactics.map(tid => { const tac = MITRE_TACTICS.find(t=>t.id===tid); return tac ? <View key={tid} style={[styles.miniTag, { borderColor: tac.color+'44', backgroundColor: tac.color+'11' }]}><Text style={[styles.miniTagText, { color: tac.color }]}>{tac.name}</Text></View> : null; })}
                    {selectedTechnique.subtechniques ? <View style={styles.miniTag}><Text style={styles.miniTagText}>{selectedTechnique.subtechniques} sub-techs</Text></View> : null}
                  </View>

                  {/* Coverage markers */}
                  <View style={styles.covMarkRow}>
                    <Text style={styles.covMarkLabel}>MARK:</Text>
                    {([['queried',Colors.info],['tested',Colors.warning],['exploited',Colors.danger]] as const).map(([v,c]) => (
                      <Pressable key={v} style={[styles.covMarkBtn, { borderColor: c+'55' }, cov===v && { backgroundColor: c+'22', borderColor: c }]} onPress={() => setCoverage(p => ({ ...p, [selectedTechnique.id]: v }))}>
                        <Text style={[styles.covMarkText, { color: c }]}>{v}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                    <Text style={styles.bodyText}>{selectedTechnique.description}</Text>
                    <View style={styles.refBox}><MaterialIcons name="open-in-new" size={12} color={Colors.info} /><Text style={styles.refText}>{'attack.mitre.org/techniques/'+selectedTechnique.id.replace('.','/')}</Text></View>
                  </ScrollView>

                  <Pressable style={({ pressed }) => [styles.primaryBtn, { marginTop: Spacing.base }, pressed && { opacity: 0.8 }]} onPress={() => handleDeepDive(selectedTechnique)}>
                    <MaterialIcons name="terminal" size={16} color={Colors.bg} /><Text style={styles.primaryBtnText}>DEEP DIVE IN CHAT</Text>
                  </Pressable>
                </>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ══ PLAY DETAIL MODAL ══ */}
      <Modal visible={selectedPlay!==null} transparent animationType="slide" onRequestClose={() => setSelectedPlay(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedPlay ? (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { flex: 1, marginRight: Spacing.md }]}>{selectedPlay.title}</Text>
                  <Pressable onPress={() => setSelectedPlay(null)} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
                </View>
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.bodyText}>{selectedPlay.description}</Text>
                  <View style={styles.promptBox}>
                    <Text style={styles.sectionLabel}>PROMPT</Text>
                    <Text style={styles.promptText}>{selectedPlay.prompt}</Text>
                  </View>
                  <View style={styles.playTags}>{selectedPlay.tags.map(t => <View key={t} style={styles.miniTag}><Text style={styles.miniTagText}>{t}</Text></View>)}</View>
                </ScrollView>
                <Pressable style={({ pressed }) => [styles.primaryBtn, { marginTop: Spacing.base }, pressed && { opacity: 0.8 }]} onPress={() => handleUsePlay(selectedPlay)}>
                  <MaterialIcons name="send" size={16} color={Colors.bg} /><Text style={styles.primaryBtnText}>USE IN CHAT</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ══ REPORT MODAL ══ */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>REPORT GENERATOR</Text>
              <Pressable onPress={() => setShowReport(false)} hitSlop={8}><MaterialIcons name="close" size={21} color={Colors.textMuted} /></Pressable>
            </View>
            <View style={styles.reportTypeRow}>
              {([['executive','description','Executive'],['technical','code','Technical'],['ioc','fingerprint','IOC']] as const).map(([type,icon,label]) => (
                <Pressable key={type} style={[styles.reportTypeBtn, reportType===type && styles.reportTypeBtnActive]} onPress={() => { setReportType(type); setReportContent(''); }}>
                  <MaterialIcons name={icon} size={14} color={reportType===type?Colors.bg:Colors.textMuted} />
                  <Text style={[styles.reportTypeBtnText, reportType===type && { color: Colors.bg }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={({ pressed }) => [styles.primaryBtn, { marginVertical: Spacing.base }, pressed && { opacity: 0.8 }, isGenerating && styles.btnDisabled]} onPress={generateReport} disabled={isGenerating}>
              {isGenerating ? <ActivityIndicator size="small" color={Colors.bg} /> : <MaterialIcons name="play-arrow" size={16} color={Colors.bg} />}
              <Text style={styles.primaryBtnText}>{isGenerating?'GENERATING...':'GENERATE'}</Text>
            </Pressable>
            {reportContent ? (
              <>
                <View style={styles.reportOutputHeader}>
                  <Text style={styles.sectionLabel}>OUTPUT</Text>
                  <Pressable onPress={async () => { try { await Share.share({ message: reportContent, title: 'AXIOM Report' }); } catch {} }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="share" size={14} color={Colors.accent} /><Text style={{ color: Colors.accent, fontSize: Typography.xs, fontWeight: Typography.semibold }}>SHARE</Text>
                  </Pressable>
                </View>
                <ScrollView style={styles.reportOutput} showsVerticalScrollIndicator={false}>
                  <Text style={styles.reportOutputText}>{reportContent}</Text>
                  <View style={{ height: 24 }} />
                </ScrollView>
              </>
            ) : null}
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
  headerSub: { color: Colors.textMuted, fontSize: Typography.sm },
  covPill: { backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary+'44', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  covPct: { color: Colors.primary, fontSize: Typography.xs, fontWeight: Typography.bold },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warning, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
  reportBtnText: { color: Colors.bg, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1 },
  subTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder, backgroundColor: Colors.bgSecondary },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.5 },
  covBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder, backgroundColor: Colors.surface },
  covStat: { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.bold },
  statLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5, marginTop: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.base, marginVertical: Spacing.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface },
  chipActive: { borderColor: Colors.primary+'55', backgroundColor: Colors.primaryMuted },
  chipText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.medium },
  chipDot: { width: 5, height: 5, borderRadius: 2.5 },
  chipCount: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold },
  list: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xs },
  sep: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.base },
  techRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.base, gap: Spacing.md },
  techIdBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, minWidth: 60, alignItems: 'center', flexShrink: 0 },
  techId: { fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.3 },
  techInfo: { flex: 1 },
  techName: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.semibold, marginBottom: 2 },
  techDesc: { color: Colors.textMuted, fontSize: Typography.sm, lineHeight: 17, marginBottom: 5 },
  techMeta: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', alignItems: 'center' },
  miniTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated },
  miniTagText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.textMuted, letterSpacing: 0.3 },
  toolCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.md },
  toolIcon: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  toolInfo: { flex: 1 },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4, flexWrap: 'wrap' },
  toolName: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.semibold, flex: 1 },
  toolDesc: { color: Colors.textMuted, fontSize: Typography.sm, lineHeight: 18 },
  playCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, padding: Spacing.base },
  playHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  catDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  playName: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: Typography.semibold, flex: 1 },
  playDesc: { color: Colors.textMuted, fontSize: Typography.sm, lineHeight: 19, marginBottom: Spacing.sm },
  playTags: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyTitle: { color: Colors.textMuted, fontSize: Typography.base },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: Spacing.base, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.base },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.base },
  modalTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, letterSpacing: 1 },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.base },
  covMarkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.base, flexWrap: 'wrap' },
  covMarkLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1 },
  covMarkBtn: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  covMarkText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  bodyText: { color: Colors.textSecondary, fontSize: Typography.base, lineHeight: 22, marginBottom: Spacing.sm },
  sectionLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, marginBottom: Spacing.xs },
  refBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: Radius.sm, padding: Spacing.sm, marginTop: Spacing.sm },
  refText: { color: Colors.info, fontSize: Typography.xs, flex: 1 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.xl, ...Shadow.redGlow },
  primaryBtnText: { color: Colors.bg, fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 1.5 },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
  promptBox: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.accent+'22', borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.base },
  promptText: { color: Colors.textSecondary, fontSize: Typography.sm, lineHeight: 20 },
  reportTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  reportTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface },
  reportTypeBtnActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  reportTypeBtnText: { color: Colors.textMuted, fontSize: Typography.sm, fontWeight: Typography.semibold },
  reportOutputHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  reportOutput: { maxHeight: 300, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.lg, padding: Spacing.base },
  reportOutputText: { color: Colors.textSecondary, fontSize: Typography.sm, lineHeight: 21 },
});
