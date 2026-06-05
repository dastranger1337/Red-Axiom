/**
 * AGENTS — Autonomous Red Team Agents
 * AI-driven autonomous operations: Recon, Exploit, Post-Exploit, Evasion, Full Chain
 * Each agent plans, executes, analyzes, and adapts in real-time
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { appendExecLog } from '@/services/executionLog';
import { useChatContext } from '@/hooks/useChatContext';
import { useRouter } from 'expo-router';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
// Route to the local AXIOM runtime (this chat's container shell). Falls back to
// Supabase only if the runtime URL isn't configured.
const SUPABASE_URL = process.env.EXPO_PUBLIC_AXIOM_RUNTIME_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// ── Agent definitions ──────────────────────────────────────────────────────────
interface AgentDef {
  id: string;
  name: string;
  codename: string;
  description: string;
  icon: string;
  color: string;
  phases: string[];
  defaultObjective: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const AGENTS: AgentDef[] = [
  {
    id: 'recon',
    name: 'Recon Agent',
    codename: 'GHOST SIGHT',
    description: 'Passive and active reconnaissance. DNS, port scanning, service fingerprinting, OSINT, web tech detection.',
    icon: 'radar',
    color: '#3399ff',
    phases: ['DNS Enum', 'Port Scan', 'Service Detect', 'Web Enum', 'OSINT', 'Fingerprint'],
    defaultObjective: 'Complete passive and active reconnaissance to map attack surface',
    riskLevel: 'low',
  },
  {
    id: 'exploit',
    name: 'Exploit Agent',
    codename: 'IRON FIST',
    description: 'Vulnerability exploitation. Web attacks, CVE exploitation, authentication bypass, RCE.',
    icon: 'flash-on',
    color: '#ff4400',
    phases: ['Vuln Scan', 'Web Attack', 'Service Exploit', 'Auth Bypass', 'RCE', 'Shell'],
    defaultObjective: 'Identify and exploit vulnerabilities to gain initial access',
    riskLevel: 'critical',
  },
  {
    id: 'postexploit',
    name: 'Post-Exploit Agent',
    codename: 'PHANTOM ROOT',
    description: 'Post-exploitation operations. Privilege escalation, persistence, credential harvesting, lateral movement.',
    icon: 'arrow-upward',
    color: '#00ff41',
    phases: ['Enum', 'PrivEsc', 'Persistence', 'Cred Harvest', 'Lateral Move', 'Exfil'],
    defaultObjective: 'Establish persistence, escalate privileges, and harvest credentials',
    riskLevel: 'high',
  },
  {
    id: 'evasion',
    name: 'Evasion Agent',
    codename: 'SILENT SHADOW',
    description: 'Defense evasion techniques. AV/EDR bypass, log clearing, AMSI patching, obfuscation.',
    icon: 'visibility-off',
    color: '#aa44ff',
    phases: ['AV Bypass', 'AMSI Patch', 'ETW Blind', 'Log Clear', 'Obfuscate', 'Cover Tracks'],
    defaultObjective: 'Evade detection mechanisms and cover operational tracks',
    riskLevel: 'high',
  },
  {
    id: 'fullchain',
    name: 'Full Chain Agent',
    codename: 'TOTAL SIEGE',
    description: 'End-to-end attack chain. Recon → Initial Access → Execution → Persistence → PrivEsc → Exfil.',
    icon: 'account-tree',
    color: '#ff2222',
    phases: ['Recon', 'Initial Access', 'Execution', 'Persistence', 'PrivEsc', 'DefEvasion', 'CredAccess', 'LateralMove', 'Exfil', 'Impact'],
    defaultObjective: 'Execute a complete attack chain from initial recon to full system compromise',
    riskLevel: 'critical',
  },
];

// ── Step types ────────────────────────────────────────────────────────────────
interface AgentStep {
  id: number;
  name: string;
  phase: string;
  objective: string;
  language: string;
  code: string;
  expected_output?: string;
  decision_logic?: string;
  mitre_id?: string;
  risk: string;
  evasion?: string;
  // Runtime
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: string;
  analysis?: {
    success: boolean;
    confidence: number;
    findings: string[];
    extracted_data: any;
    next_action: string;
    next_step_suggestion: string;
    threat_assessment?: string;
  };
  duration?: number;
}

interface AgentPlan {
  agent: string;
  objective: string;
  target: string;
  estimated_duration: string;
  risk_level: string;
  steps: AgentStep[];
  success_criteria: string;
  notes?: string;
}

interface AgentSummary {
  title: string;
  status: string;
  findings_summary: string;
  critical_findings: string[];
  vulnerabilities: string[];
  credentials_found: string[];
  mitre_coverage: string[];
  recommendations: string[];
  risk_level: string;
  next_operations: string[];
}

const RISK_COLORS: Record<string, string> = {
  low: '#00cc44', medium: '#ffaa00', high: '#ff6600', critical: '#ff2222',
};

const STATUS_CONFIG = {
  pending: { color: Colors.textMuted, icon: 'radio-button-unchecked' },
  running: { color: '#ffaa00', icon: 'play-circle' },
  success: { color: '#00ff41', icon: 'check-circle' },
  failed: { color: '#ff2222', icon: 'cancel' },
  skipped: { color: '#555', icon: 'skip-next' },
};

export default function AgentsScreen() {
  const insets = useSafeAreaInsets();
  const { injectPrompt } = useChatContext();
  const router = useRouter();

  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [target, setTarget] = useState('');
  const [objective, setObjective] = useState('');
  const [context, setContext] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [planError, setPlanError] = useState('');

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<number | null>(null);
  const [stepResults, setStepResults] = useState<AgentStep[]>([]);
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // UI state
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [killChainVisible, setKillChainVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRunning || isPlanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else {
      pulseAnim.setValue(1);
      scanAnim.setValue(0);
    }
  }, [isRunning, isPlanning]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAgentLog(prev => [...prev.slice(-99), `[${ts}] ${msg}`]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  // ── Plan generation ────────────────────────────────────────────────────────
  const handleGeneratePlan = useCallback(async () => {
    if (!selectedAgent) return;
    setIsPlanning(true);
    setPlanError('');
    setPlan(null);
    setStepResults([]);
    setAgentLog([]);
    setIsComplete(false);
    setSummary(null);

    addLog(`Initializing ${selectedAgent.name}...`);
    addLog(`Target: ${target || '(no target specified)'}`);

    try {
      const res = await fetch(`${SUPABASE_URL}/api/functions/v1/axiom-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          mode: 'plan',
          agentType: selectedAgent.id,
          target: target || '127.0.0.1',
          objective: objective || selectedAgent.defaultObjective,
          context: context || 'Authorized security assessment, Linux environment',
        }),
      });
      const data = await res.json();

      if (data.error) {
        setPlanError(data.error);
        addLog(`ERROR: ${data.error}`);
        return;
      }
      if (!data.steps?.length) {
        setPlanError('No steps in agent plan');
        return;
      }

      // Initialize step results
      const initialSteps: AgentStep[] = data.steps.map((s: any) => ({
        ...s,
        status: 'pending',
      }));
      setStepResults(initialSteps);
      setPlan({ ...data, steps: initialSteps });
      addLog(`Plan generated: ${data.steps.length} steps`);
      addLog(`Risk level: ${data.risk_level?.toUpperCase() || 'UNKNOWN'}`);
      addLog(`Estimated duration: ${data.estimated_duration || 'Unknown'}`);
    } catch (err: any) {
      setPlanError(`Network error: ${err?.message}`);
      addLog(`FATAL: ${err?.message}`);
    } finally {
      setIsPlanning(false);
    }
  }, [selectedAgent, target, objective, context, addLog]);

  // ── Execute a single step ──────────────────────────────────────────────────
  const executeStep = useCallback(async (step: AgentStep): Promise<AgentStep> => {
    addLog(`Executing: ${step.name}`);

    // Replace {TARGET} placeholder
    const tgt = target || '127.0.0.1';
    const code = step.code.replace(/\{TARGET\}/g, tgt);

    const t0 = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/api/functions/v1/code-exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ language: step.language || 'bash', code }),
      });

      const json = await res.json();
      const output = json.output || json.error || '(no output)';
      const dur = Date.now() - t0;

      addLog(`Step ${step.id} complete (${dur}ms): ${json.success ? 'OK' : 'FAILED'}`);

      // Log to ops log
      await appendExecLog({
        type: 'attack',
        target: tgt,
        command: code,
        language: step.language,
        output,
        isError: !json.success,
        durationMs: dur,
        mitreId: step.mitre_id,
        tags: ['agent', selectedAgent?.id || 'unknown', step.phase.toLowerCase()],
      });

      return {
        ...step,
        status: json.success ? 'success' : 'failed',
        output,
        duration: dur,
      };
    } catch (err: any) {
      const dur = Date.now() - t0;
      const msg = `Error: ${err?.message}`;
      addLog(`Step ${step.id} ERROR: ${err?.message}`);
      return { ...step, status: 'failed', output: msg, duration: dur };
    }
  }, [target, selectedAgent, addLog]);

  // ── Analyze step output with AI ────────────────────────────────────────────
  const analyzeStep = useCallback(async (step: AgentStep, completedSteps: AgentStep[]): Promise<AgentStep['analysis']> => {
    addLog(`Analyzing output for: ${step.name}`);
    try {
      const res = await fetch(`${SUPABASE_URL}/api/functions/v1/axiom-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          mode: 'step',
          agentType: selectedAgent?.id,
          target,
          objective: step.name,
          currentOutput: step.output?.slice(0, 1000),
          previousSteps: completedSteps.slice(-3).map(s => ({
            name: s.name,
            success: s.status === 'success',
            output: (s.output || '').slice(0, 200),
          })),
        }),
      });
      const data = await res.json();
      addLog(`Analysis: ${data.next_action?.toUpperCase() || 'continue'} | Confidence: ${data.confidence || 0}%`);
      return data;
    } catch {
      return { success: step.status === 'success', confidence: 50, findings: [], extracted_data: {}, next_action: 'continue', next_step_suggestion: '' };
    }
  }, [selectedAgent, target, addLog]);

  // ── Run all agent steps autonomously ──────────────────────────────────────
  const handleRunAgent = useCallback(async () => {
    if (!plan || isRunning) return;
    setIsRunning(true);
    setIsComplete(false);
    setSummary(null);
    addLog(`Starting ${selectedAgent?.codename || 'AGENT'} autonomous execution...`);

    const completed: AgentStep[] = [];

    for (let i = 0; i < stepResults.length; i++) {
      const step = stepResults[i];
      if (step.status === 'success') { completed.push(step); continue; }

      setCurrentStepId(step.id);

      // Mark as running
      setStepResults(prev => prev.map(s => s.id === step.id ? { ...s, status: 'running' } : s));

      // Execute
      const executed = await executeStep(step);

      // Analyze (non-blocking - don't fail agent if analysis fails)
      const analysis = await analyzeStep(executed, completed).catch(() => undefined);
      const finalStep = { ...executed, analysis };

      completed.push(finalStep);
      setStepResults(prev => prev.map(s => s.id === step.id ? finalStep : s));
      setExpandedStep(step.id);

      // Check if agent should abort
      if (analysis?.next_action === 'abort') {
        addLog(`Agent decision: ABORT — ${analysis.notes || 'critical failure'}`);
        break;
      }

      // Small pause between steps
      await new Promise(r => setTimeout(r, 300));
    }

    setCurrentStepId(null);
    setIsRunning(false);
    setIsComplete(true);
    addLog(`Agent operation complete. ${completed.filter(s => s.status === 'success').length}/${completed.length} steps succeeded.`);

    // Generate summary
    await generateSummary(completed);
  }, [plan, stepResults, isRunning, selectedAgent, executeStep, analyzeStep, addLog]);

  // ── Generate final summary ─────────────────────────────────────────────────
  const generateSummary = useCallback(async (completedSteps: AgentStep[]) => {
    setIsSummarizing(true);
    addLog('Generating operation summary...');
    try {
      const res = await fetch(`${SUPABASE_URL}/api/functions/v1/axiom-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          mode: 'summarize',
          agentType: selectedAgent?.id,
          target,
          objective: objective || selectedAgent?.defaultObjective,
          previousSteps: completedSteps.map(s => ({
            name: s.name,
            phase: s.phase,
            success: s.status === 'success',
            output: (s.output || '').slice(0, 300),
          })),
        }),
      });
      const data = await res.json();
      setSummary(data);
      setShowSummary(true);
      addLog(`Summary: ${data.status?.toUpperCase()} — ${data.findings_summary?.slice(0, 80) || 'Complete'}`);
    } catch (err: any) {
      addLog(`Summary error: ${err?.message}`);
    } finally {
      setIsSummarizing(false);
    }
  }, [selectedAgent, target, objective, addLog]);

  // ── Reset agent ────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setPlan(null);
    setStepResults([]);
    setAgentLog([]);
    setIsComplete(false);
    setSummary(null);
    setExpandedStep(null);
    setCurrentStepId(null);
    setPlanError('');
    setKillChainVisible(false);
  }, []);

  // ── Kill chain phase order ─────────────────────────────────────────────────
  const getKillChainPhases = useCallback(() => {
    if (!plan) return [];
    const phaseMap: Record<string, AgentStep[]> = {};
    stepResults.forEach(s => {
      if (!phaseMap[s.phase]) phaseMap[s.phase] = [];
      phaseMap[s.phase].push(s);
    });
    return Object.entries(phaseMap);
  }, [plan, stepResults]);

  const PHASE_COLORS: Record<string, string> = {
    Recon: '#3399ff', 'DNS Enum': '#3399ff', 'Port Scan': '#3399ff',
    'Service Detect': '#00ccff', 'Web Enum': '#00aaff', OSINT: '#0088ff',
    'Initial Access': '#ff8800', 'Auth Bypass': '#ff6600', 'Web Attack': '#ff4400',
    'Vuln Scan': '#ff8844', 'Service Exploit': '#ff5500', RCE: '#ff2200',
    Execution: '#ff4400', Persistence: '#ffcc00', PrivEsc: '#ff6600',
    'Priv Esc': '#ff6600', DefEvasion: '#00cc44', 'AV Bypass': '#00ff41',
    'AMSI Patch': '#00ee33', 'Log Clear': '#00cc22', Obfuscate: '#44ff00',
    CredAccess: '#aa44ff', 'Cred Harvest': '#aa44ff', LateralMove: '#ff2266',
    Collection: '#3399ff', C2: '#00aaff', Exfil: '#ff8800', Impact: '#ff2222',
    Shell: '#ff2222', Enum: '#3399ff', Fingerprint: '#44aaff',
  };

  const successCount = stepResults.filter(s => s.status === 'success').length;
  const failCount = stepResults.filter(s => s.status === 'failed').length;
  const totalCount = stepResults.length;
  const progressPct = totalCount > 0 ? (stepResults.filter(s => s.status !== 'pending').length / totalCount) * 100 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  // Agent selector screen
  if (!selectedAgent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AUTONOMOUS AGENTS</Text>
          <View style={styles.headerBadge}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <View style={styles.onlineDot} />
            </Animated.View>
            <Text style={styles.headerBadgeText}>AI READY</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.agentGrid, { paddingBottom: insets.bottom + 120 }]}>
          <View style={styles.introCard}>
            <MaterialIcons name="psychology" size={22} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>AUTONOMOUS AI AGENTS</Text>
              <Text style={styles.introDesc}>Each agent autonomously plans, executes real Linux commands, analyzes output, and adapts. Real Piston sandbox execution.</Text>
            </View>
          </View>

          {AGENTS.map(agent => (
            <Pressable
              key={agent.id}
              style={({ pressed }) => [styles.agentCard, { borderColor: agent.color + '33' }, pressed && { opacity: 0.8 }]}
              onPress={() => {
                setSelectedAgent(agent);
                setObjective(agent.defaultObjective);
              }}
            >
              <View style={[styles.agentIconBox, { backgroundColor: agent.color + '15', borderColor: agent.color + '33' }]}>
                <MaterialIcons name={agent.icon as any} size={28} color={agent.color} />
              </View>
              <View style={styles.agentCardBody}>
                <View style={styles.agentCardTop}>
                  <View>
                    <Text style={[styles.agentName, { color: agent.color }]}>{agent.name}</Text>
                    <Text style={styles.agentCodename}>{agent.codename}</Text>
                  </View>
                  <View style={[styles.riskBadge, { borderColor: RISK_COLORS[agent.riskLevel] + '55', backgroundColor: RISK_COLORS[agent.riskLevel] + '11' }]}>
                    <Text style={[styles.riskBadgeText, { color: RISK_COLORS[agent.riskLevel] }]}>{agent.riskLevel.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.agentDesc}>{agent.description}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseRow}>
                  {agent.phases.map(p => (
                    <View key={p} style={[styles.phaseChip, { borderColor: agent.color + '44', backgroundColor: agent.color + '0d' }]}>
                      <Text style={[styles.phaseChipText, { color: agent.color }]}>{p}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Agent operation screen
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { setSelectedAgent(null); handleReset(); }} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={16} color={Colors.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: selectedAgent.color, fontSize: Typography.base }]}>{selectedAgent.name}</Text>
          <Text style={styles.agentCodenameSm}>{selectedAgent.codename}</Text>
        </View>
        {plan ? (
          <View style={styles.headerActions}>
            <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]} onPress={() => setKillChainVisible(true)}>
              <MaterialIcons name="account-tree" size={15} color={Colors.accent} />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]} onPress={handleReset}>
              <MaterialIcons name="refresh" size={15} color={Colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Content */}
      {!plan ? (
        /* ── Configuration Form ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 120 }]}>
          <View style={[styles.agentBanner, { borderColor: selectedAgent.color + '33', backgroundColor: selectedAgent.color + '0a' }]}>
            <View style={[styles.agentIconBox, { backgroundColor: selectedAgent.color + '18', borderColor: selectedAgent.color + '33' }]}>
              <MaterialIcons name={selectedAgent.icon as any} size={24} color={selectedAgent.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.agentName, { color: selectedAgent.color }]}>{selectedAgent.name}</Text>
              <Text style={styles.agentDesc}>{selectedAgent.description}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>TARGET *</Text>
          <View style={[styles.targetInput, target && { borderColor: Colors.warning + '55' }]}>
            <MaterialIcons name="gps-fixed" size={14} color={Colors.warning} />
            <TextInput
              style={styles.targetTextInput}
              value={target}
              onChangeText={setTarget}
              placeholder="IP address or domain (e.g. 192.168.1.1)"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>OBJECTIVE</Text>
          <TextInput
            style={[styles.textArea]}
            value={objective}
            onChangeText={setObjective}
            placeholder={selectedAgent.defaultObjective}
            placeholderTextColor={Colors.textMuted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>CONTEXT / NOTES</Text>
          <TextInput
            style={styles.textArea}
            value={context}
            onChangeText={setContext}
            placeholder="e.g. Authorized test, no rate limiting, Linux target"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {planError ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={13} color={Colors.danger} />
              <Text style={styles.errorText}>{planError}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.launchBtn, { backgroundColor: selectedAgent.color }, isPlanning && styles.btnDisabled, pressed && { opacity: 0.8 }]}
            onPress={handleGeneratePlan}
            disabled={isPlanning}
          >
            {isPlanning ? (
              <><Animated.View style={{ opacity: pulseAnim }}><MaterialIcons name="psychology" size={18} color={Colors.bg} /></Animated.View><Text style={styles.launchBtnText}>PLANNING...</Text></>
            ) : (
              <><MaterialIcons name={selectedAgent.icon as any} size={18} color={Colors.bg} /><Text style={styles.launchBtnText}>INITIALIZE AGENT</Text></>
            )}
          </Pressable>

          <View style={styles.phasesPreview}>
            <Text style={styles.fieldLabel}>OPERATION PHASES</Text>
            <View style={styles.phaseRow}>
              {selectedAgent.phases.map((p, i) => (
                <React.Fragment key={p}>
                  <View style={[styles.phaseChip, { borderColor: selectedAgent.color + '55', backgroundColor: selectedAgent.color + '11' }]}>
                    <Text style={[styles.phaseChipText, { color: selectedAgent.color }]}>{p}</Text>
                  </View>
                  {i < selectedAgent.phases.length - 1 && <MaterialIcons name="arrow-forward" size={10} color={Colors.textMuted} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        /* ── Operation View ── */
        <View style={{ flex: 1 }}>
          {/* Status bar */}
          <View style={styles.statusBar}>
            <View style={styles.statusBarLeft}>
              {isRunning ? (
                <Animated.View style={{ opacity: pulseAnim }}>
                  <View style={[styles.runningIndicator, { backgroundColor: selectedAgent.color }]} />
                </Animated.View>
              ) : (
                <View style={[styles.runningIndicator, { backgroundColor: isComplete ? Colors.accent : Colors.textMuted }]} />
              )}
              <Text style={styles.statusText}>
                {isRunning ? `RUNNING — Step ${currentStepId || '?'}` : isComplete ? 'COMPLETE' : 'READY'}
              </Text>
            </View>
            <View style={styles.statusStats}>
              <Text style={[styles.statusStat, { color: Colors.accent }]}>{successCount} ✓</Text>
              <Text style={[styles.statusStat, { color: Colors.danger }]}>{failCount} ✗</Text>
              <Text style={[styles.statusStat, { color: Colors.textMuted }]}>{totalCount - successCount - failCount} ⏳</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarOuter}>
            <Animated.View style={[styles.progressBarFill, { width: `${progressPct}%` as any, backgroundColor: selectedAgent.color }]} />
          </View>

          <View style={{ flex: 1, flexDirection: 'column' }}>
            {/* Steps + Log split */}
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.stepsContent, { paddingBottom: insets.bottom + 120 }]}
            >
              {/* Plan header */}
              <View style={[styles.planHeader, { borderColor: selectedAgent.color + '33' }]}>
                <Text style={[styles.planTitle, { color: selectedAgent.color }]}>{plan.objective}</Text>
                <View style={styles.planMeta}>
                  {plan.estimated_duration ? (
                    <View style={styles.metaChip}><MaterialIcons name="timer" size={9} color={Colors.textMuted} /><Text style={styles.metaChipText}>{plan.estimated_duration}</Text></View>
                  ) : null}
                  <View style={[styles.metaChip, { borderColor: RISK_COLORS[plan.risk_level] + '44' }]}>
                    <Text style={[styles.metaChipText, { color: RISK_COLORS[plan.risk_level] }]}>{plan.risk_level?.toUpperCase() || 'UNKNOWN'} RISK</Text>
                  </View>
                  <View style={styles.metaChip}><Text style={styles.metaChipText}>{totalCount} STEPS</Text></View>
                </View>
                {plan.notes ? <Text style={styles.planNotes}>{plan.notes}</Text> : null}
              </View>

              {/* Run button */}
              {!isComplete ? (
                <Pressable
                  style={({ pressed }) => [styles.runAllBtn, { backgroundColor: selectedAgent.color }, isRunning && styles.btnDisabled, pressed && { opacity: 0.8 }]}
                  onPress={handleRunAgent}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <><Animated.View style={{ opacity: pulseAnim }}><MaterialIcons name="play-arrow" size={18} color={Colors.bg} /></Animated.View><Text style={styles.runAllBtnText}>AGENT RUNNING...</Text></>
                  ) : (
                    <><MaterialIcons name="play-arrow" size={18} color={Colors.bg} /><Text style={styles.runAllBtnText}>RUN AGENT AUTONOMOUSLY</Text></>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.runAllBtn, { backgroundColor: Colors.accent }, pressed && { opacity: 0.8 }]}
                  onPress={() => setShowSummary(true)}
                >
                  <MaterialIcons name="assessment" size={18} color={Colors.bg} />
                  <Text style={styles.runAllBtnText}>VIEW OPERATION REPORT</Text>
                </Pressable>
              )}

              {/* Steps */}
              {stepResults.map((step, idx) => {
                const stCfg = STATUS_CONFIG[step.status];
                const phaseColor = PHASE_COLORS[step.phase] || Colors.textMuted;
                const isExpanded = expandedStep === step.id;
                const isCurrentlyRunning = currentStepId === step.id;

                return (
                  <View key={step.id} style={[styles.stepCard, { borderColor: step.status === 'success' ? Colors.accent + '33' : step.status === 'failed' ? Colors.danger + '33' : Colors.surfaceBorder }]}>
                    <Pressable style={styles.stepHeader} onPress={() => setExpandedStep(isExpanded ? null : step.id)}>
                      <View style={[styles.stepNumBox, {
                        backgroundColor: isCurrentlyRunning ? Colors.warning + '22' : step.status === 'success' ? Colors.accent + '18' : step.status === 'failed' ? Colors.danger + '18' : Colors.surfaceElevated,
                        borderColor: isCurrentlyRunning ? Colors.warning : stCfg.color,
                      }]}>
                        {isCurrentlyRunning ? (
                          <ActivityIndicator size="small" color={Colors.warning} />
                        ) : (
                          <MaterialIcons name={stCfg.icon as any} size={14} color={stCfg.color} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.stepTitleRow}>
                          <Text style={styles.stepName} numberOfLines={1}>{step.name}</Text>
                          <View style={[styles.phaseChipSm, { borderColor: phaseColor + '44', backgroundColor: phaseColor + '0d' }]}>
                            <Text style={[styles.phaseChipSmText, { color: phaseColor }]}>{step.phase}</Text>
                          </View>
                        </View>
                        <Text style={styles.stepObjective} numberOfLines={1}>{step.objective}</Text>
                        {step.mitre_id ? <Text style={[styles.stepMitre, { color: Colors.accent }]}>{step.mitre_id}</Text> : null}
                      </View>
                      <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={Colors.textMuted} />
                    </Pressable>

                    {isExpanded ? (
                      <View style={styles.stepExpanded}>
                        <Text style={styles.codeLabel}>CODE ({step.language?.toUpperCase()})</Text>
                        <View style={styles.codeBlock}>
                          <Text style={[styles.codeText, { color: Colors.accent }]} selectable>
                            {step.code?.replace(/\{TARGET\}/g, target || '{TARGET}')}
                          </Text>
                        </View>

                        {step.expected_output ? (
                          <Text style={styles.stepMeta}>Expected: {step.expected_output}</Text>
                        ) : null}
                        {step.evasion ? (
                          <Text style={[styles.stepMeta, { color: Colors.accent }]}>Evasion: {step.evasion}</Text>
                        ) : null}

                        {/* Output */}
                        {step.output ? (
                          <View style={[styles.outputBox, { borderColor: step.status === 'success' ? Colors.accent + '22' : Colors.danger + '22' }]}>
                            <View style={styles.outputHeader}>
                              <View style={[styles.outputDot, { backgroundColor: step.status === 'success' ? Colors.accent : Colors.danger }]} />
                              <Text style={[styles.outputStatus, { color: step.status === 'success' ? Colors.accent : Colors.danger }]}>
                                {step.status.toUpperCase()} {step.duration ? `· ${step.duration}ms` : ''}
                              </Text>
                            </View>
                            <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                              <Text style={[styles.codeText, { color: step.status === 'success' ? '#88ff88' : '#ff8888', fontSize: 11 }]} selectable>
                                {step.output}
                              </Text>
                            </ScrollView>
                          </View>
                        ) : null}

                        {/* AI Analysis */}
                        {step.analysis ? (
                          <View style={styles.analysisBox}>
                            <View style={styles.analysisHeader}>
                              <MaterialIcons name="psychology" size={11} color={Colors.primary} />
                              <Text style={styles.analysisTitle}>AI ANALYSIS</Text>
                              <Text style={[styles.analysisConf, { color: (step.analysis.confidence || 0) > 70 ? Colors.accent : Colors.warning }]}>
                                {step.analysis.confidence || 0}% confidence
                              </Text>
                            </View>
                            {step.analysis.findings?.length > 0 ? (
                              <><Text style={styles.analysisLabel}>FINDINGS</Text>
                              {step.analysis.findings.slice(0, 4).map((f, i) => <Text key={i} style={styles.analysisBullet}>▸ {f}</Text>)}</>
                            ) : null}
                            {step.analysis.extracted_data?.vulnerabilities?.length > 0 ? (
                              <><Text style={styles.analysisLabel}>VULNS</Text>
                              {step.analysis.extracted_data.vulnerabilities.slice(0, 3).map((v: string, i: number) => <Text key={i} style={[styles.analysisBullet, { color: Colors.danger }]}>▸ {v}</Text>)}</>
                            ) : null}
                            {step.analysis.next_step_suggestion ? (
                              <><Text style={styles.analysisLabel}>NEXT</Text>
                              <Text style={[styles.analysisBullet, { color: Colors.accent }]}>▸ {step.analysis.next_step_suggestion}</Text></>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {/* Agent log */}
              {agentLog.length > 0 ? (
                <View style={styles.logCard}>
                  <View style={styles.logCardHeader}>
                    <MaterialIcons name="terminal" size={12} color={Colors.accent} />
                    <Text style={styles.logCardTitle}>AGENT LOG</Text>
                  </View>
                  {agentLog.slice(-20).map((line, i) => (
                    <Text key={i} style={styles.logLine}>{line}</Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── Kill Chain Visualization Modal ── */}
      <Modal visible={killChainVisible} transparent animationType="slide" onRequestClose={() => setKillChainVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <MaterialIcons name="account-tree" size={16} color={Colors.accent} />
              <Text style={styles.modalTitle}>KILL CHAIN</Text>
              <Pressable onPress={() => setKillChainVisible(false)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                <MaterialIcons name="close" size={21} color={Colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Phase timeline */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.killChainTimeline}>
                {getKillChainPhases().map(([phase, steps], pIdx) => {
                  const phaseColor = PHASE_COLORS[phase] || selectedAgent?.color || Colors.textMuted;
                  const phaseSuccess = steps.every(s => s.status === 'success');
                  const phasePartial = steps.some(s => s.status === 'success');
                  const phaseFailed = steps.every(s => s.status === 'failed');
                  const phaseRunning = steps.some(s => s.status === 'running');

                  const statusColor = phaseRunning ? Colors.warning : phaseFailed ? Colors.danger : phaseSuccess ? Colors.accent : phasePartial ? Colors.warning : Colors.textMuted;

                  return (
                    <View key={phase} style={styles.killChainPhase}>
                      <View style={[styles.killChainNode, { borderColor: statusColor, backgroundColor: statusColor + '18' }]}>
                        <MaterialIcons
                          name={phaseRunning ? 'play-circle' : phaseFailed ? 'cancel' : phaseSuccess ? 'check-circle' : 'radio-button-unchecked'}
                          size={18}
                          color={statusColor}
                        />
                        <Text style={[styles.killChainNodeText, { color: statusColor }]} numberOfLines={2}>{phase}</Text>
                        <Text style={styles.killChainStepCount}>{steps.filter(s => s.status === 'success').length}/{steps.length}</Text>
                      </View>
                      {pIdx < getKillChainPhases().length - 1 ? (
                        <View style={[styles.killChainArrow, { backgroundColor: statusColor + '88' }]} />
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Steps per phase */}
              {getKillChainPhases().map(([phase, steps]) => {
                const phaseColor = PHASE_COLORS[phase] || selectedAgent?.color || Colors.textMuted;
                return (
                  <View key={phase} style={styles.killChainSection}>
                    <View style={styles.killChainSectionHeader}>
                      <View style={[styles.phaseChipSm, { borderColor: phaseColor + '55', backgroundColor: phaseColor + '18' }]}>
                        <Text style={[styles.phaseChipSmText, { color: phaseColor, fontSize: Typography.xs }]}>{phase}</Text>
                      </View>
                      <View style={styles.phaseLine} />
                    </View>
                    {steps.map(step => {
                      const stCfg = STATUS_CONFIG[step.status];
                      return (
                        <View key={step.id} style={styles.killChainStep}>
                          <MaterialIcons name={stCfg.icon as any} size={13} color={stCfg.color} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.killChainStepName}>{step.name}</Text>
                            {step.mitre_id ? <Text style={[styles.killChainMitre, { color: Colors.accent }]}>{step.mitre_id}</Text> : null}
                          </View>
                          <View style={[styles.riskBadge, { borderColor: RISK_COLORS[step.risk] + '44', backgroundColor: RISK_COLORS[step.risk] + '0d' }]}>
                            <Text style={[styles.riskBadgeText, { color: RISK_COLORS[step.risk], fontSize: 8 }]}>{step.risk?.toUpperCase()}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Summary Modal ── */}
      <Modal visible={showSummary && summary !== null} transparent animationType="slide" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <MaterialIcons name="assessment" size={16} color={Colors.warning} />
              <Text style={styles.modalTitle}>OPERATION REPORT</Text>
              <Pressable onPress={() => setShowSummary(false)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                <MaterialIcons name="close" size={21} color={Colors.textMuted} />
              </Pressable>
            </View>
            {isSummarizing ? (
              <View style={{ alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md }}>
                <ActivityIndicator size="large" color={Colors.warning} />
                <Text style={{ color: Colors.warning, fontSize: Typography.sm, fontFamily: MONO }}>Generating report...</Text>
              </View>
            ) : summary ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.summaryTitle}>{summary.title}</Text>
                <View style={styles.summaryStatusRow}>
                  <View style={[styles.riskBadge, {
                    borderColor: (summary.status === 'success' ? Colors.accent : summary.status === 'partial' ? Colors.warning : Colors.danger) + '55',
                    backgroundColor: (summary.status === 'success' ? Colors.accent : summary.status === 'partial' ? Colors.warning : Colors.danger) + '11',
                    paddingHorizontal: Spacing.md,
                    paddingVertical: 4,
                  }]}>
                    <Text style={[styles.riskBadgeText, { color: summary.status === 'success' ? Colors.accent : summary.status === 'partial' ? Colors.warning : Colors.danger, fontSize: 11 }]}>
                      {summary.status?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.riskBadge, { borderColor: RISK_COLORS[summary.risk_level] + '55', backgroundColor: RISK_COLORS[summary.risk_level] + '11', paddingHorizontal: Spacing.md, paddingVertical: 4 }]}>
                    <Text style={[styles.riskBadgeText, { color: RISK_COLORS[summary.risk_level], fontSize: 11 }]}>{summary.risk_level?.toUpperCase()} RISK</Text>
                  </View>
                </View>

                <Text style={styles.summaryText}>{summary.findings_summary}</Text>

                {summary.critical_findings?.length > 0 ? (
                  <View style={styles.summarySection}>
                    <Text style={[styles.summarySectionTitle, { color: Colors.danger }]}>CRITICAL FINDINGS</Text>
                    {summary.critical_findings.map((f, i) => <Text key={i} style={[styles.summaryBullet, { color: Colors.danger }]}>▸ {f}</Text>)}
                  </View>
                ) : null}
                {summary.vulnerabilities?.length > 0 ? (
                  <View style={styles.summarySection}>
                    <Text style={[styles.summarySectionTitle, { color: Colors.warning }]}>VULNERABILITIES</Text>
                    {summary.vulnerabilities.map((v, i) => <Text key={i} style={styles.summaryBullet}>▸ {v}</Text>)}
                  </View>
                ) : null}
                {summary.credentials_found?.length > 0 ? (
                  <View style={styles.summarySection}>
                    <Text style={[styles.summarySectionTitle, { color: Colors.primary }]}>CREDENTIALS</Text>
                    {summary.credentials_found.map((c, i) => <Text key={i} style={[styles.summaryBullet, { color: Colors.primary }]}>▸ {c}</Text>)}
                  </View>
                ) : null}
                {summary.mitre_coverage?.length > 0 ? (
                  <View style={styles.summarySection}>
                    <Text style={[styles.summarySectionTitle, { color: Colors.accent }]}>MITRE COVERAGE</Text>
                    <View style={styles.mitreRow}>
                      {summary.mitre_coverage.map(m => (
                        <View key={m} style={[styles.phaseChipSm, { borderColor: Colors.accent + '44', backgroundColor: Colors.accentMuted }]}>
                          <Text style={[styles.phaseChipSmText, { color: Colors.accent }]}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {summary.recommendations?.length > 0 ? (
                  <View style={styles.summarySection}>
                    <Text style={styles.summarySectionTitle}>RECOMMENDATIONS</Text>
                    {summary.recommendations.map((r, i) => <Text key={i} style={[styles.summaryBullet, { color: Colors.info }]}>▸ {r}</Text>)}
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.launchBtn, { backgroundColor: Colors.primary, marginTop: Spacing.base }, pressed && { opacity: 0.8 }]}
                  onPress={() => {
                    injectPrompt(`I just ran the ${selectedAgent?.name} on target ${target}. ${summary.findings_summary} Key findings: ${summary.critical_findings?.join(', ') || 'none'}. What should I do next?`);
                    setShowSummary(false);
                    router.push('/(tabs)');
                  }}
                >
                  <MaterialIcons name="chat" size={16} color={Colors.bg} />
                  <Text style={styles.launchBtnText}>DISCUSS WITH AXIOM AI</Text>
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold, letterSpacing: 2 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary + '33', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  headerBadgeText: { color: Colors.primary, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1, fontFamily: MONO },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.primary },
  iconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.surfaceBorder },
  agentGrid: { padding: Spacing.base, gap: Spacing.md },
  introCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary + '33', borderRadius: Radius.lg, padding: Spacing.base },
  introTitle: { color: Colors.primary, fontSize: Typography.sm, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO, marginBottom: 4 },
  introDesc: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 17 },
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.base },
  agentIconBox: { width: 52, height: 52, borderRadius: Radius.lg, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  agentCardBody: { flex: 1, gap: 5 },
  agentCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  agentName: { fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 0.5 },
  agentCodename: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  agentCodenameSm: { color: Colors.textMuted, fontSize: 9, letterSpacing: 1, fontFamily: MONO },
  agentDesc: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
  riskBadgeText: { fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5 },
  phaseRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 4 },
  phaseChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1 },
  phaseChipText: { fontSize: 9, fontWeight: Typography.medium },
  phaseChipSm: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1 },
  phaseChipSmText: { fontSize: 9, fontWeight: Typography.bold },

  // Form
  formContent: { padding: Spacing.base, gap: Spacing.sm },
  agentBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.base },
  fieldLabel: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  targetInput: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.warning + '08', borderWidth: 1, borderColor: Colors.warning + '22', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  targetTextInput: { flex: 1, color: Colors.warning, fontSize: Typography.sm, fontFamily: MONO },
  textArea: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, fontFamily: MONO, minHeight: 56 },
  errorBox: { flexDirection: 'row', gap: 6, backgroundColor: Colors.danger + '0d', borderWidth: 1, borderColor: Colors.danger + '33', borderRadius: Radius.md, padding: Spacing.md },
  errorText: { flex: 1, color: Colors.danger, fontSize: Typography.xs, lineHeight: 17 },
  launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.base, borderRadius: Radius.xl },
  launchBtnText: { color: Colors.bg, fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 1.5 },
  phasesPreview: { gap: Spacing.sm, marginTop: Spacing.sm },

  // Status bar
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, backgroundColor: Colors.bgSecondary, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  statusBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  runningIndicator: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1, fontFamily: MONO },
  statusStats: { flexDirection: 'row', gap: Spacing.md },
  statusStat: { fontSize: Typography.sm, fontWeight: Typography.bold, fontFamily: MONO },
  progressBarOuter: { height: 3, backgroundColor: Colors.surfaceElevated },
  progressBarFill: { height: 3, borderRadius: 2 },

  // Steps
  stepsContent: { padding: Spacing.base, gap: Spacing.sm },
  planHeader: { backgroundColor: Colors.surface, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm },
  planTitle: { fontSize: Typography.base, fontWeight: Typography.bold, lineHeight: 22 },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated },
  metaChipText: { fontSize: 9, fontWeight: Typography.bold, color: Colors.textMuted },
  planNotes: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  runAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.xl, marginBottom: Spacing.sm, ...Shadow.redGlow },
  runAllBtnText: { color: Colors.bg, fontSize: Typography.sm, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },

  stepCard: { backgroundColor: Colors.surface, borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  stepNumBox: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2, flexWrap: 'wrap' },
  stepName: { color: Colors.textPrimary, fontSize: Typography.sm, fontWeight: Typography.semibold, flex: 1 },
  stepObjective: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  stepMitre: { fontSize: 9, fontWeight: Typography.bold, letterSpacing: 0.5, fontFamily: MONO, marginTop: 2 },
  stepMeta: { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16 },
  stepExpanded: { borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, padding: Spacing.md, gap: Spacing.sm },
  codeLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  codeBlock: { backgroundColor: '#000', borderWidth: 1, borderColor: Colors.accent + '22', borderRadius: Radius.md, padding: Spacing.md },
  codeText: { fontFamily: MONO, fontSize: 11, lineHeight: 18, color: Colors.accent },
  outputBox: { backgroundColor: '#000', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm },
  outputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  outputDot: { width: 6, height: 6, borderRadius: 3 },
  outputStatus: { fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1, fontFamily: MONO },
  analysisBox: { backgroundColor: Colors.primaryMuted, borderWidth: 1, borderColor: Colors.primary + '33', borderRadius: Radius.md, padding: Spacing.md, gap: 3 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  analysisTitle: { color: Colors.primary, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO, flex: 1 },
  analysisConf: { fontSize: 9, fontWeight: Typography.bold, fontFamily: MONO },
  analysisLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1, marginTop: 4 },
  analysisBullet: { color: Colors.textSecondary, fontSize: Typography.xs, lineHeight: 16 },

  logCard: { backgroundColor: '#030303', borderWidth: 1, borderColor: Colors.accent + '18', borderRadius: Radius.md, padding: Spacing.md },
  logCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  logCardTitle: { color: Colors.accent, fontSize: 9, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO },
  logLine: { color: '#4af', fontSize: 10, lineHeight: 17, fontFamily: MONO },

  // Kill chain modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: Spacing.base, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.base },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.base },
  modalTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, letterSpacing: 2 },
  killChainTimeline: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: 0 },
  killChainPhase: { flexDirection: 'row', alignItems: 'center' },
  killChainNode: { width: 72, alignItems: 'center', gap: 4, padding: 8, borderRadius: Radius.md, borderWidth: 1 },
  killChainNodeText: { fontSize: 8, fontWeight: Typography.bold, letterSpacing: 0.3, textAlign: 'center', lineHeight: 12 },
  killChainStepCount: { color: Colors.textMuted, fontSize: 8, fontFamily: MONO },
  killChainArrow: { width: 16, height: 2, marginHorizontal: 2 },
  killChainSection: { marginTop: Spacing.md, gap: Spacing.xs },
  killChainSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  phaseLine: { flex: 1, height: 1, backgroundColor: Colors.surfaceBorder },
  killChainStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5, paddingHorizontal: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.sm },
  killChainStepName: { color: Colors.textPrimary, fontSize: Typography.xs, fontWeight: Typography.medium, flex: 1 },
  killChainMitre: { fontSize: 9, fontFamily: MONO },

  // Summary
  summaryTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, marginBottom: Spacing.sm },
  summaryStatusRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryText: { color: Colors.textSecondary, fontSize: Typography.sm, lineHeight: 20, marginBottom: Spacing.md },
  summarySection: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: 4 },
  summarySectionTitle: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 1.5, fontFamily: MONO, marginBottom: 4 },
  summaryBullet: { color: Colors.textSecondary, fontSize: Typography.xs, lineHeight: 17 },
  mitreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
});
