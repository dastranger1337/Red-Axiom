import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Message } from '@/services/aiService';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

interface Props {
  messages: Message[];
}

// Keyword noise scoring — higher = louder forensic signature
const NOISE_SIGNALS: { pattern: RegExp; score: number; label: string }[] = [
  // Extremely noisy
  { pattern: /mimikatz|lsass|dump|sekurlsa|dcsync/i, score: 95, label: 'LSASS Dump' },
  { pattern: /meterpreter|metasploit|msf|payload\.exe/i, score: 90, label: 'Metasploit' },
  { pattern: /nmap|masscan|shodan|gobuster|dirb/i, score: 80, label: 'Active Scan' },
  { pattern: /psexec|wmiexec|impacket|smbexec/i, score: 85, label: 'Lateral Move' },
  { pattern: /reverse.shell|bash.tcp|nc.e|ncat.*e/i, score: 88, label: 'Rev Shell' },
  { pattern: /sqlmap|burp|zap|nikto/i, score: 75, label: 'Web Scan' },
  // Moderate noise
  { pattern: /powershell|invoke-expression|iex\s|encodedcommand/i, score: 70, label: 'PowerShell' },
  { pattern: /bloodhound|sharphound|adrecon/i, score: 72, label: 'AD Enum' },
  { pattern: /cobalt.?strike|beacon|cs-beacon|havoc|sliver/i, score: 78, label: 'C2 Framework' },
  { pattern: /net user|net group|nltest|dsquery/i, score: 60, label: 'AD Enum' },
  { pattern: /whoami|hostname|ipconfig|ifconfig|netstat/i, score: 40, label: 'Local Enum' },
  // Lower noise
  { pattern: /dnsx|subfinder|amass|assetfinder/i, score: 35, label: 'Passive Recon' },
  { pattern: /curl|wget|httpx|httprobe/i, score: 30, label: 'HTTP Probe' },
  { pattern: /osint|shodan|censys|fofa|spyse/i, score: 20, label: 'OSINT' },
  { pattern: /persistence|scheduled.task|cron|registry/i, score: 65, label: 'Persistence' },
  { pattern: /amsi|etw|patch|bypass|hook/i, score: 68, label: 'EDR Evasion' },
  { pattern: /living.off.the.land|lolbas|lolbin|wmic/i, score: 50, label: 'LOTL' },
];

function computeNoiseScore(messages: Message[]): { score: number; topSignals: string[] } {
  const recentContent = messages
    .filter(m => m.role !== 'system')
    .slice(-6)
    .map(m => m.content)
    .join(' ');

  if (!recentContent.trim()) return { score: 0, topSignals: [] };

  let totalScore = 0;
  const triggered: { label: string; score: number }[] = [];

  for (const sig of NOISE_SIGNALS) {
    if (sig.pattern.test(recentContent)) {
      triggered.push({ label: sig.label, score: sig.score });
      totalScore = Math.max(totalScore, sig.score);
    }
  }

  // Average with max for smoother reading
  if (triggered.length > 1) {
    const avg = triggered.reduce((a, b) => a + b.score, 0) / triggered.length;
    totalScore = Math.round((totalScore * 0.6 + avg * 0.4));
  }

  const topSignals = triggered
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(t => t.label);

  return { score: Math.min(100, totalScore), topSignals };
}

function getColor(score: number): string {
  if (score < 25) return '#00ff41';
  if (score < 45) return '#88ff00';
  if (score < 60) return '#ffcc00';
  if (score < 75) return '#ff8800';
  if (score < 88) return '#ff4400';
  return '#ff0000';
}

function getLabel(score: number): string {
  if (score === 0) return 'SILENT';
  if (score < 25) return 'GHOST';
  if (score < 45) return 'QUIET';
  if (score < 60) return 'LOW';
  if (score < 75) return 'MODERATE';
  if (score < 88) return 'LOUD';
  return 'CRITICAL';
}

export function StealthMeter({ messages }: Props) {
  const { score, topSignals } = useMemo(() => computeNoiseScore(messages), [messages]);
  const color = getColor(score);
  const label = getLabel(score);
  const pct = score / 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="radar" size={12} color={color} />
        <Text style={[styles.title, { color }]}>STEALTH</Text>
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Text style={styles.score}>{score}</Text>
      </View>

      {/* Gauge bar */}
      <View style={styles.gaugeTrack}>
        {/* Gradient segments */}
        <View style={styles.gaugeSegments}>
          {['#00ff41', '#88ff00', '#ffcc00', '#ff8800', '#ff4400', '#ff0000'].map((c, i) => (
            <View key={i} style={[styles.segment, { backgroundColor: c + (i < 5 ? '33' : '22') }]} />
          ))}
        </View>
        {/* Fill overlay */}
        <View style={[styles.gaugeFill, { width: `${score}%` as any, backgroundColor: color }]} />
        {/* Indicator dot */}
        {score > 0 ? (
          <View style={[styles.gaugeDot, { left: `${Math.min(score, 96)}%` as any, backgroundColor: color, shadowColor: color }]} />
        ) : null}
      </View>

      {/* Active signals */}
      {topSignals.length > 0 ? (
        <View style={styles.signals}>
          {topSignals.map(sig => (
            <View key={sig} style={[styles.signalBadge, { borderColor: color + '44', backgroundColor: color + '11' }]}>
              <Text style={[styles.signalText, { color }]}>{sig}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 1.5,
  },
  label: {
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 1,
    flex: 1,
  },
  score: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700' as any,
  },
  gaugeTrack: {
    height: 6,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  gaugeSegments: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
  },
  gaugeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    opacity: 0.85,
  },
  gaugeDot: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.bg,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
    marginLeft: -6,
  },
  signals: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  signalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  signalText: {
    fontSize: 9,
    fontWeight: '700' as any,
    letterSpacing: 0.5,
  },
});
